const express = require("express");
const shortid = require("shortid");

const models = require("../db/models");
const redis = require("../modules/redis");
const routeUtils = require("./utils");
const logger = require("../modules/logging")(".");

const router = express.Router();

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

    const users = await models.User.find({
      deleted: false,
      $or: [
        { avatar: true },
        { banner: true },
        { profileBackground: true },
      ],
    })
      .sort("-lastActive")
      .limit(100)
      .select("id name avatar banner profileBackground lastActive -_id")
      .lean();

    const entries = [];
    const collectionCounts = {
      "Profile Avatars": 0,
      Banners: 0,
      "Profile Backgrounds": 0,
    };

    for (const user of users) {
      if (user.avatar) {
        collectionCounts["Profile Avatars"] += 1;
        entries.push({
          id: `${user.id}-avatar`,
          name: `${user.name} Avatar`,
          collection: "Profile Avatars",
          artist: user.name,
          rarity: "User Upload",
          status: "Active",
          updated: formatRelativeTime(user.lastActive),
        });
      }

      if (user.banner) {
        collectionCounts.Banners += 1;
        entries.push({
          id: `${user.id}-banner`,
          name: `${user.name} Banner`,
          collection: "Banners",
          artist: user.name,
          rarity: "User Upload",
          status: "Active",
          updated: formatRelativeTime(user.lastActive),
        });
      }

      if (user.profileBackground) {
        collectionCounts["Profile Backgrounds"] += 1;
        entries.push({
          id: `${user.id}-background`,
          name: `${user.name} Background`,
          collection: "Profile Backgrounds",
          artist: user.name,
          rarity: "User Upload",
          status: "Active",
          updated: formatRelativeTime(user.lastActive),
        });
      }
    }

    const collections = Object.entries(collectionCounts).map(([name, count]) => ({
      name,
      count: `${count} assets`,
      theme: `Live count for ${name.toLowerCase()}.`,
      releaseWindow: "Managed from current user profile data",
    }));

    res.send({ entries, collections });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading avatar assets.");
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

    res.send({
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
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading admin settings summary.");
  }
});

module.exports = router;
