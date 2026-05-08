const express = require("express");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const sharp = require("sharp");
const shortid = require("shortid");

const models = require("../db/models");
const redis = require("../modules/redis");
const gameCatalogUtils = require("../lib/gameCatalog");
const brandingUtils = require("../lib/platformBranding");
const routeUtils = require("./utils");
const defaultSettings = require("../lib/defaultSettings");
const logger = require("../modules/logging")(".");
const shopModule = require("./shop");

const router = express.Router();
const EMOTE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const EMOTE_GROUP_MAX_UPLOADS = 100;
const EMOTE_GROUP_BATCH_MAX_BYTES =
  EMOTE_IMAGE_MAX_BYTES * EMOTE_GROUP_MAX_UPLOADS;

function normalizeShopCurrency(value, item = {}) {
  const currency = String(value || "").trim().toLowerCase();
  if (["dollar", "dollars", "usd", "usdollar", "$"].includes(currency)) {
    return "dollar";
  }
  if (["coin", "coins"].includes(currency)) return "coins";
  if (
    String(item.key || "").startsWith("avatar-") ||
    String(item.key || "").startsWith("emote-group-")
  ) {
    return "dollar";
  }
  return "coins";
}

function isAvatarItem(item = {}) {
  return String(item.key || "").startsWith("avatar-");
}

function isEmoteCatalogItem(item = {}) {
  return String(item.key || "").startsWith("emote-");
}

async function migrateLegacyCatalogItems(
  model,
  keyPattern,
  defaultLimit,
  defaultCurrency = "dollar"
) {
  const legacyItems = await models.ShopItem.find({ key: keyPattern })
    .sort("sortOrder")
    .lean();

  for (const item of legacyItems) {
    const legacyUpdatedAt = Number(item.updatedAt || 0);
    const existing = await model
      .findOne({ key: item.key })
      .select("currency updatedAt")
      .lean();

    if (
      existing &&
      defaultCurrency === "dollar" &&
      normalizeShopCurrency(existing.currency, item) === "coins" &&
      Number(existing.updatedAt || 0) === legacyUpdatedAt
    ) {
      await model
        .updateOne(
          { key: item.key },
          {
            $set: {
              currency: "dollar",
              updatedAt: Date.now(),
            },
          }
        )
        .exec();
      continue;
    }

    await model
      .updateOne(
        { key: item.key },
        {
          $setOnInsert: {
            key: item.key,
            name: item.name || item.key,
            desc: item.desc || "",
            price: Number(item.price || 0),
            currency: normalizeShopCurrency(defaultCurrency, item),
            limit: item.limit == null ? defaultLimit : Number(item.limit),
            hidden: Boolean(item.hidden),
            sortOrder: Number(item.sortOrder || 0),
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
          },
        },
        { upsert: true }
      )
      .exec();
  }
}

async function ensureAdminCatalogCollections() {
  await Promise.all([
    migrateLegacyCatalogItems(models.AvatarItem, /^avatar-/i, 1, "dollar"),
    migrateLegacyCatalogItems(models.EmoteGroup, /^emote-group-/i, 1, "dollar"),
  ]);
}

function hasAdminAccess(permissionInfo) {
  return Boolean(permissionInfo?.admin);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Unknown";
  return routeUtils.timeDisplay(Date.now() - Number(timestamp), true, " ago");
}

function formatUserStatus(user) {
  if (user.deleted) return "Deleted";
  if (user.banned) return "Suspended";
  if (user.flagged) return "Flagged";
  return "Active";
}

function calculateTrust(user, reportCount) {
  let trust = 100;

  trust -= Math.min(Number(reportCount || 0) * 8, 40);
  if (user.flagged) trust -= 25;
  if (user.banned) trust -= 45;
  if (user.deleted) trust -= 60;

  return Math.max(0, Math.min(100, trust));
}

function getRiskBand(trust) {
  if (trust <= 25) return "Critical";
  if (trust <= 50) return "High";
  if (trust <= 75) return "Medium";
  return "Low";
}

async function getPlatformBrandingDocument() {
  return models.PlatformBranding.findOneAndUpdate(
    { key: brandingUtils.BRANDING_KEY },
    {
      $setOnInsert: {
        key: brandingUtils.BRANDING_KEY,
      },
    },
    {
      new: true,
      upsert: true,
    }
  ).lean();
}

function buildAdminSettingsSummary(
  minimumGamesForRanked,
  autoApprovalEnabled,
  groupCount,
  openReports,
  activeAutomationCandidates
) {
  return {
    modules: [
      {
        title: "Ranked Access Threshold",
        description: `Users currently need ${minimumGamesForRanked} games before ranked access.`,
        status: "Approved",
      },
      {
        title: "Competitive Auto Approval",
        description: autoApprovalEnabled
          ? "Returning ranked users are auto-approved for competitive access."
          : "Competitive auto approval is currently disabled.",
        status: autoApprovalEnabled ? "Approved" : "Review",
      },
      {
        title: "Staff Groups",
        description: `${groupCount} permission groups are configured in Mongo.`,
        status: "Approved",
      },
      {
        title: "Moderation Workload",
        description: `${openReports} reports are currently open or in progress.`,
        status: openReports > 0 ? "Pending" : "Approved",
      },
    ],
    policies: [
      {
        name: "Ranked Entry Protection",
        scope: "Games",
        severity: "High",
        owner: "Live Ops",
        status: "Approved",
      },
      {
        name: "Admin Session Permission Gate",
        scope: "Admin Panel",
        severity: "High",
        owner: "Platform",
        status: "Approved",
      },
      {
        name: "Flagged User Review Queue",
        scope: "Users",
        severity: "Medium",
        owner: "Trust & Safety",
        status: activeAutomationCandidates > 0 ? "Review" : "Approved",
      },
    ],
    automationRules: [
      {
        name: "Competitive Auto Approval",
        trigger: "Eligible ranked user signs in",
        owner: "Platform",
        impact: "Adds Competitive Player when auto-approval is enabled",
        status: autoApprovalEnabled ? "Active" : "Paused",
      },
      {
        name: "Flagged User Intake",
        trigger: "Suspicious IP or shared flagged signal",
        owner: "Trust & Safety",
        impact: "Routes users into the flagged review workflow",
        status: "Active",
      },
    ],
  };
}

function removeUploadFile(relativePath) {
  if (!relativePath) return;

  const absolutePath = brandingUtils.resolveUploadPath(relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function normalizeAvatarKey(rawKey = "") {
  const trimmed = String(rawKey || "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("avatar-") ? trimmed : `avatar-${trimmed}`;
}

function getAvatarAssetRelativePath(avatarKey) {
  return `store/avatars/${avatarKey}.webp`;
}

function normalizeEmoteKey(rawKey = "") {
  const trimmed = String(rawKey || "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("emote-group-")
    ? trimmed
    : `emote-group-${trimmed.replace(/^emote-/, "")}`;
}

function getEmoteGroupIconRelativePath(groupKey) {
  return `store/emote-groups/${groupKey}.webp`;
}

function getEmoteAssetRelativePath(assetId) {
  return `store/emotes/${assetId}.webp`;
}

function toAssetSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUploadedFiles(files, fieldName) {
  const value = files?.[fieldName];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getAllUploadedFiles(files = {}) {
  return Object.values(files).flatMap((value) =>
    Array.isArray(value) ? value : [value]
  );
}

function buildEmoteAssetId(groupKey, file, index = 0) {
  const filename = file?.originalFilename || file?.name || `emote-${Date.now()}-${index}`;
  const slug = toAssetSlug(filename) || `emote-${Date.now()}-${index}`;
  if (slug.startsWith(`${groupKey}-`)) return slug;
  return `${groupKey}-${slug}`;
}

function listEmoteGroupAssets(groupKey) {
  const emoteDir = brandingUtils.resolveUploadPath("store/emotes");
  if (!fs.existsSync(emoteDir)) return [];

  return fs
    .readdirSync(emoteDir)
    .filter((filename) => filename.startsWith(`${groupKey}-`) && filename.endsWith(".webp"))
    .map((filename) => {
      const id = filename.replace(/\.webp$/i, "");
      return {
        id,
        name: id.replace(`${groupKey}-`, ""),
        imageUrl: brandingUtils.toPublicUrl(getEmoteAssetRelativePath(id)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function removeEmoteGroupAssets(groupKey) {
  for (const asset of listEmoteGroupAssets(groupKey)) {
    removeUploadFile(getEmoteAssetRelativePath(asset.id));
  }
}

async function grantEmoteAssetsToGroupOwners(groupKey, assets = []) {
  if (!assets.length) return;

  const owners = await models.User.find({
    [`itemsOwned.${groupKey}`]: { $gt: 0 },
    deleted: false,
  })
    .select("id _id")
    .lean();

  for (const owner of owners) {
    const customEmoteIds = [];
    for (const asset of assets) {
      const existingSameName = await models.CustomEmote.findOne({
        creator: owner._id,
        name: asset.name,
        deleted: false,
      })
        .select("id")
        .lean();
      if (existingSameName && existingSameName.id !== asset.id) continue;

      const customEmote = await models.CustomEmote.findOneAndUpdate(
        { creator: owner._id, id: asset.id },
        {
          $set: {
            id: asset.id,
            name: asset.name,
            extension: "webp",
            creator: owner._id,
            deleted: false,
          },
        },
        { new: true, upsert: true }
      );
      customEmoteIds.push(customEmote._id);
    }

    if (customEmoteIds.length) {
      await models.User.updateOne(
        { _id: owner._id },
        { $addToSet: { customEmotes: { $each: customEmoteIds } } }
      ).exec();
      await redis.cacheUserInfo(owner.id, true);
    }
  }
}

async function createBrandingModAction(userId, name, args = []) {
  await models.ModAction.create({
    id: shortid.generate(),
    modId: userId,
    name,
    args,
    reason: name,
    date: Date.now(),
  });
}

async function getManagedGames() {
  return gameCatalogUtils.syncGameCatalog(models);
}

function parseUploadForm(form, req) {
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve([fields, files]);
    });
  });
}

async function getSessionInfo(req) {
  const userId = await routeUtils.verifyLoggedIn(req, true);

  if (!userId) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
    };
  }

  const user = await redis.getUserInfo(userId);
  const permissionInfo = (await redis.getUserPermissions(userId)) || {
    perms: {},
    rank: 0,
  };
  const dbUser = await models.User.findOne({ id: userId, deleted: false })
    .select("admin -_id")
    .lean();
  const admin = Boolean(dbUser?.admin);
  const authorized = hasAdminAccess({ admin });

  return {
    authenticated: true,
    authorized,
    user: {
      id: user?.id || userId,
      name: user?.name || userId,
      avatar: user?.avatar || false,
      csrf: req.session?.user?.csrf,
      admin,
      rank: Number(permissionInfo.rank || 0),
      perms: permissionInfo.perms || {},
    },
  };
}

async function verifyAdminAccess(req, res) {
  const sessionInfo = await getSessionInfo(req);

  if (!sessionInfo.authenticated) {
    res.status(401).send({ authenticated: false, authorized: false });
    return null;
  }

  if (!sessionInfo.authorized) {
    res.status(403).send(sessionInfo);
    return null;
  }

  return sessionInfo;
}

router.get("/session", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await getSessionInfo(req);

    if (!sessionInfo.authenticated) {
      res.status(401).send(sessionInfo);
      return;
    }

    if (!sessionInfo.authorized) {
      res.status(403).send(sessionInfo);
      return;
    }

    res.send(sessionInfo);
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin session.");
  }
});

router.get("/overview", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const [
      activeUsers,
      openTaskCount,
      avatarAssetCount,
      flaggedUsers,
      modActions,
      liveGames,
    ] = await Promise.all([
      models.User.countDocuments({ deleted: false }),
      models.Report.countDocuments({
        status: { $in: ["open", "in-progress"] },
      }),
      models.User.countDocuments({
        deleted: false,
        $or: [
          { avatar: true },
          { banner: true },
          { profileBackground: true },
        ],
      }),
      models.User.countDocuments({ deleted: false, flagged: true }),
      models.ModAction.find({})
        .sort("-date")
        .limit(4)
        .select("name modId date args -_id")
        .lean(),
      redis.getAllGames(),
    ]);

    const liveGameCount = (liveGames || []).filter((game) =>
      ["Open", "In Progress"].includes(game.status)
    ).length;

    const modIds = modActions.map((action) => action.modId).filter(Boolean);
    const modNames = modIds.length
      ? await models.User.find({ id: { $in: modIds } })
          .select("id name -_id")
          .lean()
      : [];
    const modNameMap = new Map(modNames.map((mod) => [mod.id, mod.name]));

    res.send({
      stats: [
        {
          label: "Active Users",
          value: activeUsers.toLocaleString(),
          delta: `${flaggedUsers} flagged`,
          tone: flaggedUsers > 0 ? "warning" : "success",
          detail: "Live user count from Mongo",
        },
        {
          label: "Open Tasks",
          value: openTaskCount.toLocaleString(),
          delta: openTaskCount > 0 ? "Needs review" : "Clear",
          tone: openTaskCount > 0 ? "warning" : "success",
          detail: "Open and in-progress reports",
        },
        {
          label: "Live Games",
          value: liveGameCount.toLocaleString(),
          delta: "Redis live state",
          tone: "info",
          detail: "Open and in-progress games",
        },
        {
          label: "Avatar Assets",
          value: avatarAssetCount.toLocaleString(),
          delta: "Profile visuals",
          tone: "secondary",
          detail: "Users with avatar, banner, or background",
        },
      ],
      alerts: [
        `There are ${openTaskCount} moderation tasks currently open.`,
        `There are ${liveGameCount} active games in the live service.`,
        `${flaggedUsers} flagged users currently need trust review.`,
      ],
      activityFeed: modActions.map((action) => ({
        title: action.name,
        description: `${modNameMap.get(action.modId) || "Staff"} completed a ${action.name.toLowerCase()} action.`,
        when: formatRelativeTime(action.date),
      })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin overview.");
  }
});

router.get("/users", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const users = await models.User.find({ deleted: false })
      .sort("-lastActive")
      .limit(150)
      .select(
        "_id id name email joined lastActive rank permissions flagged banned deleted coins avatar banner profileBackground admin"
      )
      .lean();

    const userObjectIds = users.map((user) => user._id);
    const userIds = users.map((user) => user.id);

    const [inGroups, reportCounts] = await Promise.all([
      models.InGroup.find({ user: { $in: userObjectIds } })
        .populate("group", "name rank permissions -_id")
        .lean(),
      models.Report.aggregate([
        {
          $match: {
            reportedUserId: { $in: userIds },
          },
        },
        {
          $group: {
            _id: "$reportedUserId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const groupMap = new Map();
    for (const record of inGroups) {
      const key = String(record.user);
      const group = record.group;
      if (!group) continue;

      const existing = groupMap.get(key) || [];
      existing.push(group);
      groupMap.set(key, existing);
    }

    const reportCountMap = new Map(
      reportCounts.map((entry) => [entry._id, entry.count])
    );

    const items = users.map((user) => {
      const groups = groupMap.get(String(user._id)) || [];
      const reportCount = Number(reportCountMap.get(user.id) || 0);
      const trust = calculateTrust(user, reportCount);
      const scope = user.admin
        ? "Full admin access"
        : "Standard player access";

      return {
        id: user.id,
        name: user.name,
        email: Array.isArray(user.email) ? user.email[0] || "" : user.email || "",
        role: user.admin ? "Admin" : "Player",
        admin: Boolean(user.admin),
        status: formatUserStatus(user),
        reports: reportCount,
        trust,
        lastSeen: formatRelativeTime(user.lastActive || user.joined),
        region: "Global",
        scope,
        riskBand: getRiskBand(trust),
        lastAction: user.banned
          ? "Account restricted"
          : user.flagged
            ? "Flagged for review"
            : "Recent activity recorded",
        coins: Number(user.coins || 0),
        hasAvatar: Boolean(user.avatar || user.banner || user.profileBackground),
      };
    });

    res.send({ items });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin users.");
  }
});

router.patch("/users/:id/admin", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const targetUserId = String(req.params.id || "").trim();
    const rawAdmin = req.body?.admin;
    const nextAdmin =
      rawAdmin === true ||
      rawAdmin === "true" ||
      rawAdmin === 1 ||
      rawAdmin === "1";

    if (!targetUserId) {
      res.status(400).send("Invalid user id.");
      return;
    }

    if (targetUserId === sessionInfo.user.id && !nextAdmin) {
      res.status(400).send("You cannot remove your own admin access.");
      return;
    }

    const targetUser = await models.User.findOne({
      id: targetUserId,
      deleted: false,
    })
      .select("id name admin -_id")
      .lean();

    if (!targetUser) {
      res.status(404).send("User not found.");
      return;
    }

    await models.User.updateOne(
      { id: targetUserId },
      {
        $set: {
          admin: nextAdmin,
        },
      }
    ).exec();

    await redis.cacheUserInfo(targetUserId, true);

    const actionName = nextAdmin
      ? "Granted Admin Access"
      : "Removed Admin Access";

    await models.ModAction.create({
      id: shortid.generate(),
      modId: sessionInfo.user.id,
      name: actionName,
      args: [targetUserId],
      reason: `${actionName} for ${targetUser.name || targetUserId}`,
      date: Date.now(),
    });

    res.send({
      ok: true,
      user: {
        id: targetUserId,
        admin: nextAdmin,
        role: nextAdmin ? "Admin" : "Player",
        scope: nextAdmin ? "Full admin access" : "Standard player access",
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating admin access.");
  }
});

router.get("/games", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const allGames = (await redis.getAllGames()) || [];
    const liveGames = allGames.filter((game) =>
      ["Open", "In Progress"].includes(game.status)
    );

    const setupIds = [
      ...new Set(
        liveGames
          .map((game) => game?.settings?.setup)
          .filter(Boolean)
      ),
    ];
    const gameIds = liveGames.map((game) => game.id);

    const [setups, reportCounts] = await Promise.all([
      setupIds.length
        ? models.Setup.find({ id: { $in: setupIds } })
            .select("id name -_id")
            .lean()
        : [],
      gameIds.length
        ? models.Report.aggregate([
            {
              $match: {
                gameId: { $in: gameIds },
                status: { $in: ["open", "in-progress"] },
              },
            },
            {
              $group: {
                _id: "$gameId",
                count: { $sum: 1 },
              },
            },
          ])
        : [],
    ]);

    const setupMap = new Map(setups.map((setup) => [setup.id, setup.name]));
    const reportCountMap = new Map(
      reportCounts.map((entry) => [entry._id, entry.count])
    );

    const items = await Promise.all(
      liveGames.map(async (game) => {
        const reportCount = Number(reportCountMap.get(game.id) || 0);
        const hostName = game.hostId
          ? await redis.getUserName(game.hostId)
          : "Unknown";
        const setupName = setupMap.get(game?.settings?.setup) || "Untitled Setup";

        return {
          id: game.id,
          title: setupName,
          host: hostName || "Unknown",
          players: Array.isArray(game.players) ? game.players.length : 0,
          state: game.status || "Running",
          health:
            reportCount >= 3
              ? "Investigating"
              : reportCount > 0
                ? "Needs Review"
                : "Healthy",
          region: game.lobbyName || game.lobby || "Main",
          incident:
            reportCount > 0
              ? `${reportCount} active report(s) attached to this game.`
              : "No active incident on record.",
        };
      })
    );

    res.send({ items });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin games.");
  }
});

router.get("/games/queues", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const allGames = (await redis.getAllGames()) || [];
    const liveGames = allGames.filter((game) =>
      ["Open", "In Progress"].includes(game.status)
    );

    const queueMap = new Map();

    for (const game of liveGames) {
      const queueName = game.lobbyName || game.lobby || "Main";
      const existing = queueMap.get(queueName) || {
        name: queueName,
        mode: game?.settings?.competitive
          ? "Competitive"
          : game?.settings?.ranked
            ? "Ranked"
            : "Casual",
        players: 0,
        openGames: 0,
        inProgressGames: 0,
        region: queueName,
      };

      existing.players += Array.isArray(game.players) ? game.players.length : 0;
      if (game.status === "Open") existing.openGames += 1;
      if (game.status === "In Progress") existing.inProgressGames += 1;

      queueMap.set(queueName, existing);
    }

    const items = Array.from(queueMap.values()).map((queue) => ({
      name: queue.name,
      mode: queue.mode,
      players: queue.players,
      wait: `${queue.openGames} open / ${queue.inProgressGames} live`,
      state: queue.openGames > 0 ? "Healthy" : "Review",
      region: queue.region,
    }));

    res.send({ items });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading queue health.");
  }
});

router.get("/games/incidents", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const reports = await models.Report.find({
      gameId: { $exists: true, $ne: "" },
      status: { $in: ["open", "in-progress"] },
    })
      .sort("-createdAt")
      .limit(20)
      .select("gameId description status createdAt -_id")
      .lean();

    const uniqueGameIds = [...new Set(reports.map((report) => report.gameId))];
    const allGames = (await redis.getAllGames()) || [];
    const gameMap = new Map(allGames.map((game) => [game.id, game]));

    const items = await Promise.all(
      uniqueGameIds.map(async (gameId) => {
        const game = gameMap.get(gameId);
        if (!game) return null;

        const hostName = game.hostId
          ? await redis.getUserName(game.hostId)
          : "Unknown";
        const report = reports.find((entry) => entry.gameId === gameId);

        return {
          id: gameId,
          title: game.lobbyName || game.lobby || gameId,
          health: report?.status === "in-progress" ? "Investigating" : "Needs Review",
          incident: report?.description || "Game flagged for manual review.",
          host: hostName || "Unknown",
          region: game.lobbyName || game.lobby || "Main",
        };
      })
    );

    res.send({ items: items.filter(Boolean) });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading game incidents.");
  }
});

router.get("/avatars", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;
    await ensureAdminCatalogCollections();

    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 10)));
    const search = String(req.query?.search || "").trim();

    const query = { key: /^avatar-/i };
    if (search) {
      query.$or = [
        { key: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
        { desc: new RegExp(search, "i") },
      ];
    }

    const [total, avatarShopItems, allAvatarItems] = await Promise.all([
      models.AvatarItem.countDocuments(query),
      models.AvatarItem.find(query)
        .sort("sortOrder")
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select("_id key name desc price currency limit hidden sortOrder updatedAt -_id")
        .lean(),
      models.AvatarItem.find({ key: /^avatar-/i })
        .select("hidden -_id")
        .lean(),
    ]);

    const entries = avatarShopItems.map((item) => ({
      id: item.key,
      key: item.key,
      name: item.name || item.key,
      description: item.desc || "",
      price: Number(item.price || 0),
      currency: normalizeShopCurrency(item.currency, item),
      limit: item.limit == null ? null : Number(item.limit),
      hidden: Boolean(item.hidden),
      sortOrder: Number(item.sortOrder || 0),
      imageUrl: brandingUtils.toPublicUrl(getAvatarAssetRelativePath(item.key)),
      collection: "Profile Avatars",
      artist: "Store Asset",
      rarity: Number(item.limit || 0) === 1 ? "Limited Ownership" : "Standard",
      status: item.hidden ? "Hidden" : "Published",
      updated: formatRelativeTime(item.updatedAt || Date.now()),
    }));

    const publishedCount = allAvatarItems.filter((item) => !item.hidden).length;
    const hiddenCount = allAvatarItems.length - publishedCount;

    const collections = [
      {
        name: "Profile Avatars",
        count: `${allAvatarItems.length} assets`,
        theme: "Store-managed profile image catalog for users.",
        releaseWindow: `${publishedCount} published / ${hiddenCount} hidden`,
      },
    ];

    res.send({
      entries,
      collections,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading avatar assets.");
  }
});

router.post("/avatars", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.body?.key);
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const price = Number(req.body?.price || 0);
    const currency = normalizeShopCurrency(req.body?.currency, {
      key,
    });
    const limit =
      req.body?.limit == null || req.body?.limit === ""
        ? null
        : Number(req.body?.limit);
    const hidden = Boolean(req.body?.hidden);

    if (!key || !/^avatar-[a-z0-9-]+$/.test(key)) {
      res.status(400).send("Avatar key must start with avatar- and use letters, numbers, or hyphens.");
      return;
    }
    if (!name) {
      res.status(400).send("Avatar name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).send("Avatar price must be a positive number.");
      return;
    }
    if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
      res.status(400).send("Avatar limit must be null or a number greater than 0.");
      return;
    }

    await ensureAdminCatalogCollections();
    const exists = await models.AvatarItem.findOne({ key }).select("key -_id").lean();
    if (exists) {
      res.status(400).send("Avatar key already exists.");
      return;
    }

    const lastItem = await models.AvatarItem.findOne({})
      .sort("-sortOrder")
      .select("sortOrder")
      .lean();

    const created = await models.AvatarItem.create({
      key,
      name,
      desc: description,
      price,
      currency,
      limit,
      hidden,
      sortOrder: Number(lastItem?.sortOrder || 0) + 1,
      updatedAt: Date.now(),
    });

    await routeUtils.createModAction(sessionInfo.user.id, "Created Avatar Item", [
      key,
      name,
    ]);
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        key: created.key,
        name: created.name,
        description: created.desc || "",
        price: Number(created.price || 0),
        currency: normalizeShopCurrency(created.currency, created),
        limit: created.limit == null ? null : Number(created.limit),
        hidden: Boolean(created.hidden),
        sortOrder: Number(created.sortOrder || 0),
        imageUrl: brandingUtils.toPublicUrl(getAvatarAssetRelativePath(created.key)),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error creating avatar item.");
  }
});

router.patch("/avatars/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.params.key);
    if (!key) {
      res.status(400).send("Invalid avatar key.");
      return;
    }

    const updates = {};
    if (req.body?.name !== undefined) updates.name = String(req.body.name || "").trim();
    if (req.body?.description !== undefined)
      updates.desc = String(req.body.description || "").trim();
    if (req.body?.price !== undefined) updates.price = Number(req.body.price || 0);
    if (req.body?.currency !== undefined)
      updates.currency = normalizeShopCurrency(req.body.currency, { key });
    if (req.body?.limit !== undefined)
      updates.limit = req.body.limit == null || req.body.limit === "" ? null : Number(req.body.limit);
    if (req.body?.hidden !== undefined) updates.hidden = Boolean(req.body.hidden);
    updates.updatedAt = Date.now();

    if (updates.name !== undefined && !updates.name) {
      res.status(400).send("Avatar name is required.");
      return;
    }
    if (updates.price !== undefined && (!Number.isFinite(updates.price) || updates.price < 0)) {
      res.status(400).send("Avatar price must be a positive number.");
      return;
    }
    if (
      updates.limit !== undefined &&
      updates.limit != null &&
      (!Number.isFinite(updates.limit) || updates.limit < 1)
    ) {
      res.status(400).send("Avatar limit must be null or a number greater than 0.");
      return;
    }

    await ensureAdminCatalogCollections();
    const updated = await models.AvatarItem.findOneAndUpdate({ key }, { $set: updates }, { new: true })
      .select("key name desc price currency limit hidden sortOrder")
      .lean();
    if (!updated) {
      res.status(404).send("Avatar item not found.");
      return;
    }

    await routeUtils.createModAction(sessionInfo.user.id, "Updated Avatar Item", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        key: updated.key,
        name: updated.name,
        description: updated.desc || "",
        price: Number(updated.price || 0),
        currency: normalizeShopCurrency(updated.currency, updated),
        limit: updated.limit == null ? null : Number(updated.limit),
        hidden: Boolean(updated.hidden),
        sortOrder: Number(updated.sortOrder || 0),
        imageUrl: brandingUtils.toPublicUrl(getAvatarAssetRelativePath(updated.key)),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating avatar item.");
  }
});

router.patch("/avatars/:key/hidden", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.params.key);
    const hidden = Boolean(req.body?.hidden);
    await ensureAdminCatalogCollections();
    const updated = await models.AvatarItem.findOneAndUpdate(
      { key },
      { $set: { hidden, updatedAt: Date.now() } },
      { new: true }
    )
      .select("key hidden -_id")
      .lean();
    if (!updated) {
      res.status(404).send("Avatar item not found.");
      return;
    }

    await routeUtils.createModAction(
      sessionInfo.user.id,
      hidden ? "Hid Avatar Item" : "Unhid Avatar Item",
      [key]
    );
    shopModule.invalidateShopItemsCache();
    res.send({ ok: true, key, hidden: updated.hidden });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating avatar visibility.");
  }
});

router.post("/avatars/:key/image", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.params.key);
    await ensureAdminCatalogCollections();
    const item = await models.AvatarItem.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Avatar item not found.");
      return;
    }

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;
    const [, files] = await parseUploadForm(form, req);
    const file = files.image;
    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = getAvatarAssetRelativePath(key);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 256,
        height: 256,
        fit: sharp.fit.cover,
        position: sharp.strategy.attention,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toFile(absolutePath);

    await models.AvatarItem.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Updated Avatar Item Image", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, imageUrl: brandingUtils.toPublicUrl(relativePath) });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }
    logger.error(e);
    res.status(500).send("Error uploading avatar image.");
  }
});

router.delete("/avatars/:key/image", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.params.key);
    await ensureAdminCatalogCollections();
    const item = await models.AvatarItem.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Avatar item not found.");
      return;
    }

    removeUploadFile(getAvatarAssetRelativePath(key));
    await models.AvatarItem.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Removed Avatar Item Image", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing avatar image.");
  }
});

router.delete("/avatars/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeAvatarKey(req.params.key);
    await ensureAdminCatalogCollections();
    const existing = await models.AvatarItem.findOne({ key }).select("key name -_id").lean();
    if (!existing) {
      res.status(404).send("Avatar item not found.");
      return;
    }

    removeUploadFile(getAvatarAssetRelativePath(key));
    await models.AvatarItem.deleteOne({ key }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Deleted Avatar Item", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, name: existing.name });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error deleting avatar item.");
  }
});

router.get("/emotes", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;
    await ensureAdminCatalogCollections();

    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 10)));
    const search = String(req.query?.search || "").trim();

    const query = { key: /^emote-group-/i };
    if (search) {
      query.$or = [
        { key: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
        { desc: new RegExp(search, "i") },
      ];
    }

    const [total, emoteShopItems, allEmoteItems] = await Promise.all([
      models.EmoteGroup.countDocuments(query),
      models.EmoteGroup.find(query)
        .sort("sortOrder")
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select("_id key name desc price currency limit hidden sortOrder updatedAt -_id")
        .lean(),
      models.EmoteGroup.find({ key: /^emote-group-/i })
        .select("hidden -_id")
        .lean(),
    ]);

    const entries = emoteShopItems.map((item) => ({
      id: item.key,
      key: item.key,
      name: item.name || item.key,
      description: item.desc || "",
      price: Number(item.price || 0),
      currency: normalizeShopCurrency(item.currency, item),
      limit: item.limit == null ? null : Number(item.limit),
      hidden: Boolean(item.hidden),
      sortOrder: Number(item.sortOrder || 0),
      imageUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(item.key)),
      iconUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(item.key)),
      emotes: listEmoteGroupAssets(item.key),
      collection: "Chat Emote Groups",
      artist: "Store Asset",
      rarity: Number(item.limit || 0) === 1 ? "Limited Ownership" : "Standard",
      status: item.hidden ? "Hidden" : "Published",
      updated: formatRelativeTime(item.updatedAt || Date.now()),
    }));

    const publishedCount = allEmoteItems.filter((item) => !item.hidden).length;
    const hiddenCount = allEmoteItems.length - publishedCount;

    const collections = [
      {
        name: "Chat Emote Groups",
        count: `${allEmoteItems.length} assets`,
        theme: "Store-managed chat emote groups users can unlock.",
        releaseWindow: `${publishedCount} published / ${hiddenCount} hidden`,
      },
    ];

    res.send({
      entries,
      collections,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading emote assets.");
  }
});

router.post("/emotes", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.body?.key);
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const price = Number(req.body?.price || 0);
    const currency = normalizeShopCurrency(req.body?.currency, {
      key,
    });
    const limit =
      req.body?.limit == null || req.body?.limit === ""
        ? 1
        : Number(req.body?.limit);
    const hidden = Boolean(req.body?.hidden);

    if (!key || !/^emote-group-[a-z0-9-]+$/.test(key)) {
      res.status(400).send("Emote group key must start with emote-group- and use letters, numbers, or hyphens.");
      return;
    }
    if (!name) {
      res.status(400).send("Emote group name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).send("Emote group price must be a positive number.");
      return;
    }
    if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
      res.status(400).send("Emote group limit must be null or a number greater than 0.");
      return;
    }

    await ensureAdminCatalogCollections();
    const exists = await models.EmoteGroup.findOne({ key }).select("key -_id").lean();
    if (exists) {
      res.status(400).send("Emote group key already exists.");
      return;
    }

    const lastItem = await models.EmoteGroup.findOne({})
      .sort("-sortOrder")
      .select("sortOrder")
      .lean();

    const created = await models.EmoteGroup.create({
      key,
      name,
      desc: description,
      price,
      currency,
      limit,
      hidden,
      sortOrder: Number(lastItem?.sortOrder || 0) + 1,
      updatedAt: Date.now(),
    });

    await routeUtils.createModAction(sessionInfo.user.id, "Created Emote Group", [
      key,
      name,
    ]);
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        key: created.key,
        name: created.name,
        description: created.desc || "",
        price: Number(created.price || 0),
        currency: normalizeShopCurrency(created.currency, created),
        limit: created.limit == null ? null : Number(created.limit),
        hidden: Boolean(created.hidden),
        sortOrder: Number(created.sortOrder || 0),
        imageUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(created.key)),
        iconUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(created.key)),
        emotes: [],
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error creating emote group.");
  }
});

router.patch("/emotes/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    if (!key) {
      res.status(400).send("Invalid emote group key.");
      return;
    }

    const updates = {};
    if (req.body?.name !== undefined) updates.name = String(req.body.name || "").trim();
    if (req.body?.description !== undefined)
      updates.desc = String(req.body.description || "").trim();
    if (req.body?.price !== undefined) updates.price = Number(req.body.price || 0);
    if (req.body?.currency !== undefined)
      updates.currency = normalizeShopCurrency(req.body.currency, { key });
    if (req.body?.limit !== undefined)
      updates.limit = req.body.limit == null || req.body.limit === "" ? null : Number(req.body.limit);
    if (req.body?.hidden !== undefined) updates.hidden = Boolean(req.body.hidden);
    updates.updatedAt = Date.now();

    if (updates.name !== undefined && !updates.name) {
      res.status(400).send("Emote group name is required.");
      return;
    }
    if (updates.price !== undefined && (!Number.isFinite(updates.price) || updates.price < 0)) {
      res.status(400).send("Emote group price must be a positive number.");
      return;
    }
    if (
      updates.limit !== undefined &&
      updates.limit != null &&
      (!Number.isFinite(updates.limit) || updates.limit < 1)
    ) {
      res.status(400).send("Emote group limit must be null or a number greater than 0.");
      return;
    }

    await ensureAdminCatalogCollections();
    const updated = await models.EmoteGroup.findOneAndUpdate({ key }, { $set: updates }, { new: true })
      .select("key name desc price currency limit hidden sortOrder")
      .lean();
    if (!updated) {
      res.status(404).send("Emote group not found.");
      return;
    }

    await routeUtils.createModAction(sessionInfo.user.id, "Updated Emote Group", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        key: updated.key,
        name: updated.name,
        description: updated.desc || "",
        price: Number(updated.price || 0),
        currency: normalizeShopCurrency(updated.currency, updated),
        limit: updated.limit == null ? null : Number(updated.limit),
        hidden: Boolean(updated.hidden),
        sortOrder: Number(updated.sortOrder || 0),
        imageUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(updated.key)),
        iconUrl: brandingUtils.toPublicUrl(getEmoteGroupIconRelativePath(updated.key)),
        emotes: listEmoteGroupAssets(updated.key),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating emote group.");
  }
});

router.patch("/emotes/:key/hidden", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    const hidden = Boolean(req.body?.hidden);
    await ensureAdminCatalogCollections();
    const updated = await models.EmoteGroup.findOneAndUpdate(
      { key },
      { $set: { hidden, updatedAt: Date.now() } },
      { new: true }
    )
      .select("key hidden -_id")
      .lean();
    if (!updated) {
      res.status(404).send("Emote group not found.");
      return;
    }

    await routeUtils.createModAction(
      sessionInfo.user.id,
      hidden ? "Hid Emote Group" : "Unhid Emote Group",
      [key]
    );
    shopModule.invalidateShopItemsCache();
    res.send({ ok: true, key, hidden: updated.hidden });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating emote group visibility.");
  }
});

router.post("/emotes/:key/image", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    await ensureAdminCatalogCollections();
    const item = await models.EmoteGroup.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Emote group not found.");
      return;
    }

    const form = new formidable();
    form.maxFileSize = EMOTE_IMAGE_MAX_BYTES;
    form.maxFields = 1;
    const [, files] = await parseUploadForm(form, req);
    const file = files.image;
    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = getEmoteGroupIconRelativePath(key);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path, { animated: true })
      .rotate()
      .resize({
        width: 64,
        height: 64,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toFile(absolutePath);

    await models.EmoteGroup.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Updated Emote Group Icon", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, imageUrl: brandingUtils.toPublicUrl(relativePath) });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 2 MB.");
      return;
    }
    logger.error(e);
    res.status(500).send("Error uploading emote group icon.");
  }
});

router.post("/emotes/:key/items", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    await ensureAdminCatalogCollections();
    const item = await models.EmoteGroup.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Emote group not found.");
      return;
    }

    const form = new formidable({
      multiples: true,
      maxFileSize: EMOTE_GROUP_BATCH_MAX_BYTES,
      maxFields: 10,
    });
    const [, files] = await parseUploadForm(form, req);
    const fieldFiles = [
      ...getUploadedFiles(files, "emotes"),
      ...getUploadedFiles(files, "emotes[]"),
      ...getUploadedFiles(files, "images"),
      ...getUploadedFiles(files, "image"),
    ];
    const uploadedFiles = (fieldFiles.length ? fieldFiles : getAllUploadedFiles(files))
      .filter((file) => file?.path);

    if (!uploadedFiles.length) {
      res.status(400).send("No emote image files were received.");
      return;
    }
    if (uploadedFiles.length > EMOTE_GROUP_MAX_UPLOADS) {
      res.status(400).send(`Upload up to ${EMOTE_GROUP_MAX_UPLOADS} emotes at once.`);
      return;
    }
    if (uploadedFiles.some((file) => Number(file.size || 0) > EMOTE_IMAGE_MAX_BYTES)) {
      res.status(400).send("Each image must be less than 2 MB.");
      return;
    }

    const saved = [];
    for (let index = 0; index < uploadedFiles.length; index++) {
      const file = uploadedFiles[index];
      const assetId = buildEmoteAssetId(key, file, index);
      const relativePath = getEmoteAssetRelativePath(assetId);
      const absolutePath = brandingUtils.resolveUploadPath(relativePath);
      brandingUtils.ensureDirectory(path.dirname(absolutePath));

      await sharp(file.path, { animated: true })
        .rotate()
        .resize({
          width: 64,
          height: 64,
          fit: "inside",
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .webp({ quality: 92 })
        .toFile(absolutePath);

      saved.push({
        id: assetId,
        name: assetId.replace(`${key}-`, ""),
        imageUrl: brandingUtils.toPublicUrl(relativePath),
      });
    }

    await models.EmoteGroup.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Uploaded Emote Group Items", [
      key,
      `${saved.length}`,
    ]);
    await grantEmoteAssetsToGroupOwners(key, saved);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, emotes: listEmoteGroupAssets(key), saved });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Upload batch is too large. Upload fewer images at once.");
      return;
    }
    logger.error(e);
    res.status(500).send("Error uploading emote group items.");
  }
});

router.delete("/emotes/:key/image", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    await ensureAdminCatalogCollections();
    const item = await models.EmoteGroup.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Emote group not found.");
      return;
    }

    removeUploadFile(getEmoteGroupIconRelativePath(key));
    await models.EmoteGroup.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Removed Emote Group Icon", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing emote group icon.");
  }
});

router.delete("/emotes/:key/items/:itemId", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    const itemId = String(req.params.itemId || "").trim().toLowerCase();
    await ensureAdminCatalogCollections();
    const item = await models.EmoteGroup.findOne({ key }).select("key -_id").lean();
    if (!item) {
      res.status(404).send("Emote group not found.");
      return;
    }
    if (!itemId.startsWith(`${key}-`)) {
      res.status(400).send("Invalid emote item.");
      return;
    }

    removeUploadFile(getEmoteAssetRelativePath(itemId));
    await models.CustomEmote.updateMany(
      { id: itemId },
      { $set: { deleted: true } }
    ).exec();
    await models.EmoteGroup.updateOne({ key }, { $set: { updatedAt: Date.now() } }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Deleted Emote Group Item", [
      key,
      itemId,
    ]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, emotes: listEmoteGroupAssets(key) });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error deleting emote group item.");
  }
});

router.delete("/emotes/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = normalizeEmoteKey(req.params.key);
    await ensureAdminCatalogCollections();
    const existing = await models.EmoteGroup.findOne({ key }).select("key name -_id").lean();
    if (!existing) {
      res.status(404).send("Emote group not found.");
      return;
    }

    const groupAssets = listEmoteGroupAssets(key);
    removeUploadFile(getEmoteGroupIconRelativePath(key));
    removeEmoteGroupAssets(key);
    await models.CustomEmote.updateMany(
      { id: { $in: groupAssets.map((asset) => asset.id) } },
      { $set: { deleted: true } }
    ).exec();
    await models.EmoteGroup.deleteOne({ key }).exec();
    await routeUtils.createModAction(sessionInfo.user.id, "Deleted Emote Group", [key]);
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true, key, name: existing.name });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error deleting emote group.");
  }
});

router.get("/settings/gamecatalogs", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const games = await getManagedGames();

    res.send({
      items: gameCatalogUtils.buildGameCatalogPayload(games),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading managed game catalogs.");
  }
});

router.post("/settings/gamecatalogs", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const title = String(req.body?.title || "").trim();
    const slug = gameCatalogUtils.slugifyGameTitle(req.body?.slug || title);

    if (!title) {
      res.status(400).send("Game catalog title is required.");
      return;
    }

    if (!slug) {
      res.status(400).send("Game catalog slug is required.");
      return;
    }

    const existingSlug = await models.GameCatalog.findOne({ slug })
      .select("key -_id")
      .lean();

    if (existingSlug) {
      res.status(400).send("Game catalog slug must be unique.");
      return;
    }

    const existingKey = await models.GameCatalog.findOne({ key: slug })
      .select("key -_id")
      .lean();

    if (existingKey) {
      res.status(400).send("Game catalog key must be unique.");
      return;
    }

    const lastGameCatalog = await models.GameCatalog.findOne({})
      .sort("-sortOrder")
      .select("sortOrder -_id")
      .lean();

    const createdGameCatalog = await models.GameCatalog.create({
      key: slug,
      title,
      slug,
      hidden: false,
      coins: Number(req.body?.coins || 0),
      pointsFinishGame: Number(req.body?.pointsFinishGame ?? 20),
      pointsWin: Number(req.body?.pointsWin ?? 25),
      pointsCorrectVote: Number(req.body?.pointsCorrectVote ?? 10),
      pointsRoleSuccess: Number(req.body?.pointsRoleSuccess ?? 15),
      sortOrder: Number(lastGameCatalog?.sortOrder || 0) + 1,
      updatedAt: Date.now(),
      updatedBy: sessionInfo.user.id,
    });

    await routeUtils.createModAction(sessionInfo.user.id, "Created Game Catalog", [
      slug,
    ]);

    res.send({
      ok: true,
      item: gameCatalogUtils.buildGameCatalogPayload([
        createdGameCatalog.toObject(),
      ])[0],
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error creating game catalog.");
  }
});

router.patch("/settings/gamecatalogs/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    await getManagedGames();

    const key = decodeURIComponent(String(req.params.key || "").trim());
    const title = String(req.body?.title || "").trim();
    const slug = gameCatalogUtils.slugifyGameTitle(req.body?.slug || "");

    if (!title) {
      res.status(400).send("Game title is required.");
      return;
    }

    if (!slug) {
      res.status(400).send("Game slug is required.");
      return;
    }

    const existingGame = await models.GameCatalog.findOne({ key })
      .select("key slug -_id")
      .lean();

    if (!existingGame) {
      res.status(404).send("Game not found.");
      return;
    }

    const slugConflict = await models.GameCatalog.findOne({
      slug,
      key: { $ne: key },
    })
      .select("key -_id")
      .lean();

    if (slugConflict) {
      res.status(400).send("Game slug must be unique.");
      return;
    }

    const updateFields = {
      title,
      slug,
      coins: Number(req.body?.coins || 0),
      updatedAt: Date.now(),
      updatedBy: sessionInfo.user.id,
    };

    for (const field of [
      "pointsFinishGame",
      "pointsWin",
      "pointsCorrectVote",
      "pointsRoleSuccess",
    ]) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updateFields[field] = Number(req.body[field] || 0);
      }
    }

    const updatedGame = await models.GameCatalog.findOneAndUpdate(
      { key },
      {
        $set: updateFields,
      },
      { new: true }
    ).lean();

    await routeUtils.createModAction(sessionInfo.user.id, "Updated Managed Game", [
      key,
      slug,
    ]);

    res.send({
      ok: true,
      item: gameCatalogUtils.buildGameCatalogPayload([updatedGame])[0],
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating managed game catalog.");
  }
});

router.patch("/settings/gamecatalogs/:key/hidden", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = decodeURIComponent(String(req.params.key || "").trim());
    const hidden = Boolean(req.body?.hidden);

    const existingGame = await models.GameCatalog.findOne({ key })
      .select("key title -_id")
      .lean();

    if (!existingGame) {
      res.status(404).send("Game catalog not found.");
      return;
    }

    const updatedGame = await models.GameCatalog.findOneAndUpdate(
      { key },
      {
        $set: {
          hidden,
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true }
    ).lean();

    await routeUtils.createModAction(
      sessionInfo.user.id,
      hidden ? "Hid Game Catalog" : "Unhid Game Catalog",
      [key]
    );

    res.send({
      ok: true,
      item: gameCatalogUtils.buildGameCatalogPayload([updatedGame])[0],
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating game catalog visibility.");
  }
});

router.post("/settings/gamecatalogs/:key/logo", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    await getManagedGames();

    const key = decodeURIComponent(String(req.params.key || "").trim());
    const existingGame = await models.GameCatalog.findOne({ key })
      .select("key logoPath -_id")
      .lean();

    if (!existingGame) {
      res.status(404).send("Game not found.");
      return;
    }

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;

    const [, files] = await parseUploadForm(form, req);
    const file = files.image;

    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = gameCatalogUtils.getGameLogoRelativePath(key);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: sharp.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toFile(absolutePath);

    const updatedGame = await models.GameCatalog.findOneAndUpdate(
      { key },
      {
        $set: {
          logoPath: relativePath,
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true }
    ).lean();

    await routeUtils.createModAction(sessionInfo.user.id, "Updated Managed Game Logo", [
      key,
    ]);

    res.send({
      ok: true,
      item: gameCatalogUtils.buildGameCatalogPayload([updatedGame])[0],
    });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }

    logger.error(e);
    res.status(500).send("Error uploading game logo.");
  }
});

router.delete("/settings/gamecatalogs/:key/logo", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    await getManagedGames();

    const key = decodeURIComponent(String(req.params.key || "").trim());
    const existingGame = await models.GameCatalog.findOne({ key })
      .select("key logoPath -_id")
      .lean();

    if (!existingGame) {
      res.status(404).send("Game not found.");
      return;
    }

    removeUploadFile(existingGame.logoPath);

    const updatedGame = await models.GameCatalog.findOneAndUpdate(
      { key },
      {
        $set: {
          logoPath: "",
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true }
    ).lean();

    await routeUtils.createModAction(sessionInfo.user.id, "Removed Managed Game Logo", [
      key,
    ]);

    res.send({
      ok: true,
      item: gameCatalogUtils.buildGameCatalogPayload([updatedGame])[0],
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing game logo.");
  }
});

router.delete("/settings/gamecatalogs/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const key = decodeURIComponent(String(req.params.key || "").trim());
    const existingGame = await models.GameCatalog.findOne({ key })
      .select("key logoPath title -_id")
      .lean();

    if (!existingGame) {
      res.status(404).send("Game catalog not found.");
      return;
    }

    removeUploadFile(existingGame.logoPath);
    await models.GameCatalog.deleteOne({ key });

    await routeUtils.createModAction(sessionInfo.user.id, "Deleted Game Catalog", [
      key,
    ]);

    res.send({
      ok: true,
      key,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error deleting game catalog.");
  }
});

router.get("/settings/general", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const [
      minimumGamesForRanked,
      autoApprovalEnabled,
      groupCount,
      openReports,
      activeAutomationCandidates,
      brandingDoc,
      defaultSettings,
    ] = await Promise.all([
      redis.getMinimumGamesForRanked(),
      redis.getAutoApprovalEnabled(),
      models.Group.countDocuments({}),
      models.Report.countDocuments({ status: { $in: ["open", "in-progress"] } }),
      models.User.countDocuments({ flagged: true, deleted: false }),
      getPlatformBrandingDocument(),
      models.DefaultSettings.findOne({ key: "default" }),
    ]);

    res.send({
      ...buildAdminSettingsSummary(
        minimumGamesForRanked,
        autoApprovalEnabled,
        groupCount,
        openReports,
        activeAutomationCandidates
      ),
      branding: brandingUtils.buildBrandingPayload(brandingDoc),
      defaultSettings: {
        registerCoinsReward: defaultSettings?.registerCoinsReward || 0,
        coinsPerDollar: defaultSettings?.coinsPerDollar || 100,
        minimumGamesForRanked: defaultSettings?.minimumGamesForRanked || 5,
        minimumPointsForCompetitive: defaultSettings?.minimumPointsForCompetitive || 150,
        openDaysPerCompetitiveRound: defaultSettings?.openDaysPerCompetitiveRound || 9,
        reviewDaysPerCompetitiveRound: defaultSettings?.reviewDaysPerCompetitiveRound || 4,
        pointsNominalAmount: defaultSettings?.pointsNominalAmount || 60,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin general settings.");
  }
});

router.patch("/settings/defaults", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const {
      registerCoinsReward,
      coinsPerDollar,
      minimumGamesForRanked,
      minimumPointsForCompetitive,
      openDaysPerCompetitiveRound,
      reviewDaysPerCompetitiveRound,
      pointsNominalAmount,
    } = req.body;

    const updated = await models.DefaultSettings.findOneAndUpdate(
      { key: "default" },
      {
        registerCoinsReward: Number(registerCoinsReward || 0),
        coinsPerDollar: Number(coinsPerDollar || 100),
        minimumGamesForRanked: Number(minimumGamesForRanked || 5),
        minimumPointsForCompetitive: Number(minimumPointsForCompetitive || 150),
        openDaysPerCompetitiveRound: Number(openDaysPerCompetitiveRound || 9),
        reviewDaysPerCompetitiveRound: Number(reviewDaysPerCompetitiveRound || 4),
        pointsNominalAmount: Number(pointsNominalAmount || 60),
        updatedAt: Date.now(),
        updatedBy: req.user?.id || "unknown",
      },
      { upsert: true, new: true }
    );

    // Invalidate cache so next request picks up new values
    defaultSettings.invalidateCache();

    res.send({
      defaultSettings: {
        registerCoinsReward: updated.registerCoinsReward,
        coinsPerDollar: updated.coinsPerDollar,
        minimumGamesForRanked: updated.minimumGamesForRanked,
        minimumPointsForCompetitive: updated.minimumPointsForCompetitive,
        openDaysPerCompetitiveRound: updated.openDaysPerCompetitiveRound,
        reviewDaysPerCompetitiveRound: updated.reviewDaysPerCompetitiveRound,
        pointsNominalAmount: updated.pointsNominalAmount,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating default settings.");
  }
});

router.post("/settings/branding/platform-logo", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;

    const [, files] = await parseUploadForm(form, req);
    const file = files.image;

    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = brandingUtils.getPlatformLogoRelativePath();
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 800,
        height: 240,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toFile(absolutePath);

    const brandingDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $set: {
          platformLogoPath: relativePath,
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Updated Platform Logo", [
      relativePath,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(brandingDoc),
    });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }

    logger.error(e);
    res.status(500).send("Error uploading platform logo.");
  }
});

router.delete("/settings/branding/platform-logo", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const brandingDoc = await getPlatformBrandingDocument();
    removeUploadFile(brandingDoc?.platformLogoPath);

    const updatedDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $set: {
          platformLogoPath: "",
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Removed Platform Logo");

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(updatedDoc),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing platform logo.");
  }
});

router.post("/settings/branding/banners/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const bannerKey = String(req.params.key || "").trim();
    if (!brandingUtils.BANNER_KEYS.includes(bannerKey)) {
      res.status(400).send("Unsupported banner key.");
      return;
    }

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;

    const [, files] = await parseUploadForm(form, req);
    const file = files.image;

    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = brandingUtils.getBannerRelativePath(bannerKey);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 1600,
        height: 900,
        fit: sharp.fit.cover,
        position: sharp.strategy.attention,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 90 })
      .toFile(absolutePath);

    const brandingDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $set: {
          [`banners.${bannerKey}`]: relativePath,
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Updated Platform Banner", [
      bannerKey,
      relativePath,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(brandingDoc),
    });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }

    logger.error(e);
    res.status(500).send("Error uploading banner image.");
  }
});

router.delete("/settings/branding/banners/:key", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const bannerKey = String(req.params.key || "").trim();
    if (!brandingUtils.BANNER_KEYS.includes(bannerKey)) {
      res.status(400).send("Unsupported banner key.");
      return;
    }

    const brandingDoc = await getPlatformBrandingDocument();
    removeUploadFile(brandingDoc?.banners?.[bannerKey]);

    const updatedDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $unset: {
          [`banners.${bannerKey}`]: 1,
        },
        $set: {
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Removed Platform Banner", [
      bannerKey,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(updatedDoc),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing banner image.");
  }
});

router.post("/settings/branding/banners/carousel/upload", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;

    const [, files] = await parseUploadForm(form, req);
    const file = files.image;

    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const bannerId = shortid.generate();
    const relativePath = brandingUtils.getCarouselBannerRelativePath(bannerId);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 1600,
        height: 900,
        fit: sharp.fit.cover,
        position: sharp.strategy.attention,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 90 })
      .toFile(absolutePath);

    const brandingDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $push: {
          carouselBanners: {
            _id: bannerId,
            path: relativePath,
          },
        },
        $set: {
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Added Carousel Banner", [
      bannerId,
      relativePath,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(brandingDoc),
    });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }

    logger.error(e);
    res.status(500).send("Error uploading carousel banner image.");
  }
});

router.delete("/settings/branding/banners/carousel/:bannerId", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const bannerId = String(req.params.bannerId || "").trim();
    if (!bannerId) {
      res.status(400).send("Banner ID is required.");
      return;
    }

    const brandingDoc = await getPlatformBrandingDocument();
    const bannerToRemove = (brandingDoc?.carouselBanners || []).find(
      (b) => b._id === bannerId
    );

    if (bannerToRemove) {
      removeUploadFile(bannerToRemove.path);
    }

    const updatedDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $pull: {
          carouselBanners: { _id: bannerId },
        },
        $set: {
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Removed Carousel Banner", [
      bannerId,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(updatedDoc),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing carousel banner image.");
  }
});

router.post("/settings/branding/game-logos/:gameType", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const gameType = decodeURIComponent(String(req.params.gameType || "").trim());
    if (!brandingUtils.GAME_TYPES.includes(gameType)) {
      res.status(400).send("Unsupported game type.");
      return;
    }

    const form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024;
    form.maxFields = 1;

    const [, files] = await parseUploadForm(form, req);
    const file = files.image;

    if (!file?.path) {
      res.status(400).send("Image file is required.");
      return;
    }

    const relativePath = brandingUtils.getGameLogoRelativePath(gameType);
    const absolutePath = brandingUtils.resolveUploadPath(relativePath);
    brandingUtils.ensureDirectory(path.dirname(absolutePath));

    await sharp(file.path)
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: sharp.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toFile(absolutePath);

    const brandingDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $set: {
          [`gameLogos.${gameType}`]: relativePath,
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Updated Game Logo", [
      gameType,
      relativePath,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(brandingDoc),
    });
  } catch (e) {
    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0) {
      res.status(400).send("Image is too large, must be less than 5 MB.");
      return;
    }

    logger.error(e);
    res.status(500).send("Error uploading game logo.");
  }
});

router.delete("/settings/branding/game-logos/:gameType", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const gameType = decodeURIComponent(String(req.params.gameType || "").trim());
    if (!brandingUtils.GAME_TYPES.includes(gameType)) {
      res.status(400).send("Unsupported game type.");
      return;
    }

    const brandingDoc = await getPlatformBrandingDocument();
    removeUploadFile(brandingDoc?.gameLogos?.[gameType]);

    const updatedDoc = await models.PlatformBranding.findOneAndUpdate(
      { key: brandingUtils.BRANDING_KEY },
      {
        $unset: {
          [`gameLogos.${gameType}`]: 1,
        },
        $set: {
          updatedAt: Date.now(),
          updatedBy: sessionInfo.user.id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await createBrandingModAction(sessionInfo.user.id, "Removed Game Logo", [
      gameType,
    ]);

    res.send({
      ok: true,
      branding: brandingUtils.buildBrandingPayload(updatedDoc),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error removing game logo.");
  }
});

router.get("/settings/summary", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const [
      minimumGamesForRanked,
      autoApprovalEnabled,
      groupCount,
      openReports,
      activeAutomationCandidates,
    ] = await Promise.all([
      redis.getMinimumGamesForRanked(),
      redis.getAutoApprovalEnabled(),
      models.Group.countDocuments({}),
      models.Report.countDocuments({ status: { $in: ["open", "in-progress"] } }),
      models.User.countDocuments({ flagged: true, deleted: false }),
    ]);

    res.send(
      buildAdminSettingsSummary(
        minimumGamesForRanked,
        autoApprovalEnabled,
        groupCount,
        openReports,
        activeAutomationCandidates
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin settings summary.");
  }
});

// Payment Methods Settings
function buildPaymentMethodResponse(pm) {
  return {
    id: pm._id,
    provider: pm.provider,
    mode: pm.mode || "test",
    active: pm.active || false,
    apiKey: pm.apiKey ? "***" : "",
    publicKey: pm.publicKey || "",
    ipnSecretKey: pm.ipnSecretKey ? "***" : "",
    baseUrl: pm.baseUrl,
    defaultCurrencies: pm.defaultCurrencies,
    test_apiKey: pm.test_apiKey ? "***" : "",
    test_publicKey: pm.test_publicKey || "",
    test_ipnSecretKey: pm.test_ipnSecretKey ? "***" : "",
    test_baseUrl: pm.test_baseUrl,
    test_defaultCurrencies: pm.test_defaultCurrencies,
    createdAt: pm.createdAt,
    updatedAt: pm.updatedAt,
    updatedBy: pm.updatedBy,
  };
}

router.get("/settings/payment-methods", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const paymentMethods = await models.PaymentMethod.find({})
      .sort("provider")
      .lean();

    res.send({
      items: paymentMethods.map((pm) => buildPaymentMethodResponse(pm)),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading payment methods.");
  }
});

router.get("/settings/payment-methods/:provider", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const provider = String(req.params.provider || "").toLowerCase().trim();

    if (!provider) {
      res.status(400).send("Provider is required.");
      return;
    }

    const paymentMethod = await models.PaymentMethod.findOne({ provider }).lean();

    if (!paymentMethod) {
      res.status(404).send("Payment method not found.");
      return;
    }

    res.send(buildPaymentMethodResponse(paymentMethod));
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading payment method.");
  }
});

router.post("/settings/payment-methods/:provider", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const provider = String(req.params.provider || "").toLowerCase().trim();
    const mode = String(req.body?.mode || "test").toLowerCase();
    const active = Boolean(req.body?.active);
    const apiKey = String(req.body?.apiKey || "").trim();
    const publicKey = String(req.body?.publicKey || "").trim();
    const ipnSecretKey = String(req.body?.ipnSecretKey || "").trim();
    const baseUrl = String(req.body?.baseUrl || "").trim();
    const defaultCurrencies = String(req.body?.defaultCurrencies || "").trim();
    const test_apiKey = String(req.body?.test_apiKey || "").trim();
    const test_publicKey = String(req.body?.test_publicKey || "").trim();
    const test_ipnSecretKey = String(req.body?.test_ipnSecretKey || "").trim();
    const test_baseUrl = String(req.body?.test_baseUrl || "").trim();
    const test_defaultCurrencies = String(req.body?.test_defaultCurrencies || "").trim();

    if (!provider) {
      res.status(400).send("Provider is required.");
      return;
    }

    if (!["test", "prod"].includes(mode)) {
      res.status(400).send("Mode must be 'test' or 'prod'.");
      return;
    }

    const validProviders = ["nowpayments", "braintree", "stripe"];
    if (!validProviders.includes(provider)) {
      res.status(400).send(`Provider must be one of: ${validProviders.join(", ")}`);
      return;
    }

    const updateData = {
      provider,
      mode,
      active,
      publicKey,
      baseUrl,
      defaultCurrencies,
      test_publicKey,
      test_baseUrl,
      test_defaultCurrencies,
      updatedAt: Date.now(),
      updatedBy: sessionInfo.user.id,
    };

    if (apiKey != "***") {
      updateData.apiKey = apiKey;
    }
    if (test_apiKey != "***") {
      updateData.test_apiKey = test_apiKey;
    }
    if (ipnSecretKey != "***") {
      updateData.ipnSecretKey = ipnSecretKey;
    }
    if (test_ipnSecretKey != "***") {
      updateData.test_ipnSecretKey = test_ipnSecretKey;
    }

    const paymentMethod = await models.PaymentMethod.findOneAndUpdate(
      { provider },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    await routeUtils.createModAction(
      sessionInfo.user.id,
      "Updated Payment Method",
      [provider, mode, active ? "active" : "inactive"]
    );

    res.send(buildPaymentMethodResponse(paymentMethod));
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating payment method.");
  }
});

// Price Items / Shop Management
router.get("/shop/items", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const shopItems = await models.ShopItem.find({
      key: { $not: /^(avatar-|emote-)/i },
    })
      .sort("sortOrder")
      .select("_id key name desc price currency limit hidden sortOrder")
      .lean();

    res.send({
      items: shopItems.map((item) => ({
        id: item._id,
        key: item.key,
        name: item.name,
        description: item.desc || "",
        price: Number(item.price || 0),
        currency: normalizeShopCurrency(item.currency, item),
        limit: item.limit,
        hidden: Boolean(item.hidden || false),
        sortOrder: item.sortOrder || 0,
      })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading shop items.");
  }
});

router.post("/shop/items", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const { key, name, description, price, currency, limit, hidden } = req.body;
    const itemKey = String(key || "").trim().toLowerCase();

    if (!itemKey || !name) {
      return res.status(400).send("Key and name are required.");
    }
    if (isAvatarItem({ key: itemKey }) || isEmoteCatalogItem({ key: itemKey })) {
      return res.status(400).send("Use the avatar or emote group catalog for this item type.");
    }

    const lastItem = await models.ShopItem.findOne({})
      .sort("-sortOrder")
      .select("sortOrder")
      .lean();

    const item = await models.ShopItem.create({
      key: itemKey,
      name: String(name).trim(),
      desc: String(description || "").trim(),
      price: Number(price || 0),
      currency: normalizeShopCurrency(currency, { key: itemKey }),
      limit: limit == null ? null : Number(limit),
      hidden: Boolean(hidden || false),
      sortOrder: Number(lastItem?.sortOrder || 0) + 1,
    });

    await routeUtils.createModAction(sessionInfo.user.id, "Created Shop Item", [
      `Key: ${item.key}`,
      `Name: ${item.name}`,
    ]);

    // Invalidate shop items cache
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        id: item._id,
        key: item.key,
        name: item.name,
        description: item.desc,
        price: item.price,
        currency: normalizeShopCurrency(item.currency, item),
        limit: item.limit,
        hidden: item.hidden,
        sortOrder: item.sortOrder,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error creating shop item.");
  }
});

router.patch("/shop/items/:itemId", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const { itemId } = req.params;
    const { name, description, price, currency, limit, hidden } = req.body;

    const item = await models.ShopItem.findById(itemId);
    if (!item) {
      return res.status(404).send("Shop item not found.");
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.desc = String(description || "").trim();
    if (price !== undefined) updates.price = Number(price || 0);
    if (currency !== undefined) updates.currency = normalizeShopCurrency(currency, item);
    if (limit !== undefined) updates.limit = limit == null ? null : Number(limit);
    if (hidden !== undefined) updates.hidden = Boolean(hidden);

    const updated = await models.ShopItem.findByIdAndUpdate(itemId, updates, {
      new: true,
    }).lean();

    await routeUtils.createModAction(sessionInfo.user.id, "Updated Shop Item", [
      `Key: ${item.key}`,
      `Name: ${updated.name}`,
    ]);

    // Invalidate shop items cache
    shopModule.invalidateShopItemsCache();

    res.send({
      ok: true,
      item: {
        id: updated._id,
        key: updated.key,
        name: updated.name,
        description: updated.desc,
        price: updated.price,
        currency: normalizeShopCurrency(updated.currency, updated),
        limit: updated.limit,
        hidden: updated.hidden,
        sortOrder: updated.sortOrder,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error updating shop item.");
  }
});

router.delete("/shop/items/:itemId", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const sessionInfo = await verifyAdminAccess(req, res);
    if (!sessionInfo) return;

    const { itemId } = req.params;

    const item = await models.ShopItem.findById(itemId);
    if (!item) {
      return res.status(404).send("Shop item not found.");
    }

    await models.ShopItem.deleteOne({ _id: itemId });

    await routeUtils.createModAction(sessionInfo.user.id, "Deleted Shop Item", [
      `Key: ${item.key}`,
      `Name: ${item.name}`,
    ]);

    // Invalidate shop items cache
    shopModule.invalidateShopItemsCache();

    res.send({ ok: true });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error deleting shop item.");
  }
});

module.exports = router;
module.exports.verifyAdminAccess = verifyAdminAccess;
