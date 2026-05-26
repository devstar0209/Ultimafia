const express = require("express");
const bluebird = require("bluebird");
const crypto = require("crypto");
const fs = require("fs");
const fbAdmin = require("firebase-admin");
const formidable = bluebird.promisifyAll(require("formidable"), {
  multiArgs: true,
});
const sharp = require("sharp");
const shortid = require("shortid");
const color = require("color");
const axios = require("axios");
const models = require("../db/models");
const routeUtils = require("./utils");
const utils = require("../lib/Utils");
const redis = require("../modules/redis");
const constants = require("../data/constants");
const dbStats = require("../db/stats");
const gameCatalogUtils = require("../lib/gameCatalog");
const { colorHasGoodContrastForBothThemes } = require("../shared/colors");
const logger = require("../modules/logging")(".");
const router = express.Router();

/** Keep in sync with `isRetroThemeForcedByCalendar` in react_main/src/utils/holidayThemes.js */
function isRetroThemeForcedByCalendar(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  return (month === 2 && day === 30) || (month === 3 && day === 1);
}

// Helper function to resolve user ID from identifier (ID or vanity URL)
async function resolveUserId(identifier) {
  // First try to find user by ID
  let user = await models.User.findOne({
    id: identifier,
    deleted: false,
  }).select("id -_id");

  if (user) {
    return user.id;
  }

  // If not found by ID, try to find by vanity URL
  const vanityUrl = await models.VanityUrl.findOne({
    url: identifier,
  }).select("userId -_id");

  if (vanityUrl) {
    // Verify the user still exists and is not deleted
    const userByVanity = await models.User.findOne({
      id: vanityUrl.userId,
      deleted: false,
    }).select("id -_id");

    if (userByVanity) {
      return userByVanity.id;
    }
  }

  return null;
}
function pokePairIds(id1, id2) {
  return id1 < id2 ? { userA: id1, userB: id2 } : { userA: id2, userB: id1 };
}

function isPokeExpired(poke) {
  return poke.status === "pending" &&
    Date.now() - poke.updatedAt > constants.pokeExpiryMillis;
}

function isDismissCooldownActive(poke) {
  return poke.status === "dismissed" && poke.dismissedAt &&
    Date.now() - poke.dismissedAt < constants.pokeDismissCooldownMillis;
}

function getUtcDayStart(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function getDailySpinAvailability(lastDailySpinAt = 0, now = Date.now()) {
  const todayStart = getUtcDayStart(now);
  const lastSpin = Number(lastDailySpinAt || 0);
  const canSpin = lastSpin < todayStart;

  return {
    canSpin,
    lastDailySpinAt: lastSpin,
    nextSpinAt: canSpin ? now : todayStart + constants.dailySpinIntervalMillis,
  };
}

function getPublicDailySpinRewards() {
  return constants.dailySpinRewards.map((reward) => ({ coins: reward.coins }));
}

function pickDailySpinReward() {
  const totalWeight = constants.dailySpinRewards.reduce(
    (total, reward) => total + reward.weight,
    0
  );
  let pick = crypto.randomInt(totalWeight);

  for (let index = 0; index < constants.dailySpinRewards.length; index++) {
    const reward = constants.dailySpinRewards[index];
    if (pick < reward.weight) return { ...reward, index };
    pick -= reward.weight;
  }

  return { ...constants.dailySpinRewards[0], index: 0 };
}

async function buildPointCatalogBalances(pointsByGameCatalog) {
  const balances = new Map(
    Object.entries(pointsByGameCatalog || {}).map(([key, points]) => [
      key,
      Number(points || 0),
    ])
  );
  const catalogs = (await gameCatalogUtils.syncGameCatalog(models)).filter(
    (catalog) => !catalog.hidden
  );
  const catalogKeys = new Set(catalogs.map((catalog) => catalog.key));
  const entries = catalogs.map((catalog) => ({
    key: catalog.key,
    points: balances.get(catalog.key) || 0,
  }));

  for (const [key, points] of balances.entries()) {
    if (!catalogKeys.has(key) && points > 0) {
      entries.push({ key, points });
    }
  }

  const catalogMap = new Map(catalogs.map((catalog) => [catalog.key, catalog]));

  return entries
    .map((entry) => {
      const catalog = catalogMap.get(entry.key);
      return {
        key: entry.key,
        title: catalog?.title || entry.key,
        points: entry.points,
        sortOrder: Number(catalog?.sortOrder || 0),
        logoUrl: catalog?.logoPath
          ? `${catalog.logoPath}?t=${catalog.updatedAt || 0}`
          : "",
      };
    })
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
    );
}

async function resolveAvatarImageUrl(user = {}) {
  const avatarKey = String(user.settings?.equippedAvatarKey || "").trim();
  if (!avatarKey) return "";

  const avatarItem = await models.AvatarItem.findOne({ key: avatarKey })
    .select("imageUrl -_id")
    .lean();
  return avatarItem?.imageUrl || "";
}

function isPurchasedItemsShopKey(key) {
  const itemKey = String(key || "");
  return !itemKey.startsWith("avatar-") && !itemKey.startsWith("emote-");
}

function getPurchasedItemsCount(key, count, user = {}) {
  if (key === "nameChange" && !user.nameChanged) {
    return Math.max(0, count - 1);
  }

  return count;
}

async function buildPurchasedItems(itemsOwned, user = {}) {
  const ownedEntries = Object.entries(itemsOwned || {})
    .filter(([key]) => isPurchasedItemsShopKey(key))
    .map(([key, count]) => ({
      key,
      count: getPurchasedItemsCount(key, Number(count || 0), user),
    }))
    .filter((item) => item.count > 0);

  if (ownedEntries.length === 0) return [];

  const ownedKeys = ownedEntries.map((item) => item.key);
  const shopItems = await models.ShopItem.find({ key: { $in: ownedKeys } })
    .select("key name sortOrder hidden -_id")
    .lean();

  const itemMap = new Map(
    shopItems.map((item) => [item.key, item])
  );

  return ownedEntries
    .map((item) => {
      const shopItem = itemMap.get(item.key);
      if (!shopItem) return null;

      return {
        key: item.key,
        name: shopItem.name || item.key,
        count: item.count,
        sortOrder: Number(shopItem?.sortOrder ?? 9999),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    );
}

function buildUserStats(stats) {
  const allStats = dbStats.allStats();
  const userStats = stats || allStats;

  for (let gameType in allStats) {
    if (!userStats[gameType]) {
      userStats[gameType] = dbStats.statsSet(gameType);
    } else {
      let statsSet = dbStats.statsSet(gameType);

      for (let objName in statsSet) {
        if (!userStats[gameType][objName]) {
          userStats[gameType][objName] = statsSet[objName];
        }
      }
    }
  }

  return userStats;
}

function getEmoteNameFromAssetId(assetId, groupKey = "") {
  const prefix = `${groupKey}-`;
  return String(assetId || "")
    .replace(prefix, "")
    .trim()
    .toLowerCase();
}

function buildEmoteGroupAssets(groupKey) {
  const emoteDir = utils.resolveUploadPath(
    `${utils.EMOTES_UPLOAD_PATH}/${groupKey}`
  );
  if (!fs.existsSync(emoteDir)) return [];

  return fs
    .readdirSync(emoteDir)
    .filter(
      (filename) =>
        filename.startsWith(`${groupKey}-`) && filename.endsWith(".webp")
    )
    .map((filename) => filename.replace(/\.webp$/i, ""))
    .sort((a, b) => a.localeCompare(b))
    .map((assetId) => ({
      id: assetId,
      name: getEmoteNameFromAssetId(assetId, groupKey),
      imageUrl: utils.toPublicUrl(
        `${utils.EMOTES_UPLOAD_PATH}/${groupKey}`,
        assetId
      ),
    }));
}

async function getPublicCurrentGame(userId) {
  const inGame = await redis.inGame(userId);
  if (!inGame) return null;

  let game = await redis.getGameInfo(inGame);
  if (!game || game.settings?.private) return null;

  const setup = await models.Setup.findOne({
    id: game.settings.setup,
  })
    .select(
      "id gameType name roles closed useRoleGroups roleGroupSizes count total -_id"
    )
    .lean();

  if (!setup) return null;

  return {
    id: game.id,
    setup: {
      id: setup.id,
      gameType: setup.gameType,
      name: setup.name,
      closed: setup.closed,
      useRoleGroups: setup.useRoleGroups,
      roleGroupSizes: setup.roleGroupSizes,
      count: setup.count,
      roles: setup.roles,
      total: setup.total,
    },
    players: game.players.length,
    status: game.status,
    scheduled: game.settings.scheduled,
    spectating: game.settings.spectating,
    lobbyName: game.settings.lobbyName,
    ranked: game.settings.ranked,
    competitive: game.settings.competitive,
  };
}

async function buildArchivedGames(userMongoId) {
  const archivedGames = await models.ArchivedGame.find({ user: userMongoId })
    .select("game description")
    .populate({
      path: "game",
      select:
        "id setup lobby endTime private broken ranked competitive spectating anonymousGame users players winners -_id",
      populate: {
        path: "setup",
        select:
          "id gameType name closed useRoleGroups roleGroupSizes count roles total -_id",
      },
      options: {
        sort: "-endTime",
        limit: constants.maxArchivedGamesMax,
      },
    });

  return archivedGames
    .filter((item) => item.game)
    .map((item) => {
      const game = item.game._doc;
      let won = null;
      if (!game.broken && game.winners && game.winners.length > 0) {
        const userIdx = (game.users || []).findIndex(
          (u) => u && u.toString() === userMongoId.toString()
        );
        if (userIdx !== -1 && game.players && game.players[userIdx]) {
          won = game.winners.includes(game.players[userIdx]);
        }
      }
      const { users, players, winners, ...rest } = game;
      return {
        ...rest,
        won,
        description: item.description,
        status: "Finished",
      };
    });
}

async function buildScrapbookInfo(userId, isSelf) {
  const stampQuery = isSelf ? { userId } : { userId, hidden: { $ne: true } };
  const stamps = await models.Stamp.find(stampQuery)
    .select("gameType role hidden _id createdAt")
    .sort("createdAt")
    .lean();

  const visibleOrder = [];
  const visibleGroups = {};
  const hiddenOrder = [];
  const hiddenGroups = {};
  const stampDetails = [];

  for (const s of stamps) {
    const stampKey = `${s.gameType}:${s.role}`;
    if (s.hidden) {
      if (!hiddenGroups[stampKey]) {
        hiddenGroups[stampKey] = {
          gameType: s.gameType,
          role: s.role,
          count: 0,
        };
        hiddenOrder.push(stampKey);
      }
      hiddenGroups[stampKey].count++;
    } else {
      if (!visibleGroups[stampKey]) {
        visibleGroups[stampKey] = {
          gameType: s.gameType,
          role: s.role,
          count: 0,
        };
        visibleOrder.push(stampKey);
      }
      visibleGroups[stampKey].count++;
    }
    if (isSelf) {
      stampDetails.push({
        id: s._id,
        gameType: s.gameType,
        role: s.role,
        hidden: s.hidden,
      });
    }
  }

  const info = {
    stamps: visibleOrder.map((k) => visibleGroups[k]),
    hiddenStamps: [],
    stampDetails: [],
    lockedStampIds: [],
    lockedCountsByRoleKey: {},
    pendingConfirmationTrades: [],
  };

  if (!isSelf) return info;

  info.hiddenStamps = hiddenOrder.map((k) => hiddenGroups[k]);
  info.stampDetails = stampDetails;

  const activeTrades = await models.StampTrade.find({
    $or: [{ initiatorId: userId }, { recipientId: userId }],
    status: { $in: ["PENDING_RESPONSE", "PENDING_CONFIRMATION"] },
  })
    .select(
      "id initiatorId initiatorStamp initiatorGameType initiatorRole recipientId recipientStamp recipientGameType recipientRole status updatedAt"
    )
    .sort({ updatedAt: -1 })
    .lean();

  const incrementLocked = (gameType, role) => {
    if (!gameType || !role) return;
    const key = `${gameType}:${role}`;
    info.lockedCountsByRoleKey[key] =
      (info.lockedCountsByRoleKey[key] || 0) + 1;
  };

  const otherUserIds = new Set();
  for (const trade of activeTrades) {
    const isInitiator = trade.initiatorId === userId;
    const otherUserId = isInitiator ? trade.recipientId : trade.initiatorId;
    if (otherUserId) otherUserIds.add(otherUserId);

    if (trade.initiatorId === userId && trade.initiatorStamp) {
      info.lockedStampIds.push(String(trade.initiatorStamp));
      incrementLocked(trade.initiatorGameType, trade.initiatorRole);
    }
    if (trade.recipientId === userId && trade.recipientStamp) {
      info.lockedStampIds.push(String(trade.recipientStamp));
      incrementLocked(trade.recipientGameType, trade.recipientRole);
    }
  }

  const otherUsers = await models.User.find({
    id: { $in: Array.from(otherUserIds) },
  })
    .select("id name avatar -_id")
    .lean();
  const otherUserMap = new Map(otherUsers.map((user) => [user.id, user]));

  info.pendingConfirmationTrades = activeTrades.map((trade) => {
    const isInitiator = trade.initiatorId === userId;
    const otherUserId = isInitiator ? trade.recipientId : trade.initiatorId;
    const otherUser = otherUserMap.get(otherUserId);
    const waitingOnYou =
      (trade.status === "PENDING_RESPONSE" && !isInitiator) ||
      (trade.status === "PENDING_CONFIRMATION" && isInitiator);

    return {
      id: trade.id,
      initiatorGameType: trade.initiatorGameType,
      initiatorRole: trade.initiatorRole,
      recipientGameType: trade.recipientGameType,
      recipientRole: trade.recipientRole,
      other: otherUser
        ? {
            id: otherUser.id,
            name: otherUser.name,
            avatar: otherUser.avatar,
          }
        : null,
      isInitiator,
      status: trade.status,
      waitingOnYou,
      updatedAt: trade.updatedAt,
    };
  });

  return info;
}

async function buildTrophies(userId) {
  const trophies = await models.Trophy.find({
    ownerId: userId,
    revoked: { $ne: true },
  })
    .populate("owner", "id name avatar vanityUrl")
    .select("id name ownerId owner type createdAt -_id")
    .sort("-createdAt")
    .lean();

  return (trophies || []).map((trophy) => ({
    id: trophy.id,
    name: trophy.name,
    ownerId: trophy.ownerId,
    type: trophy.type || "silver",
    owner: trophy.owner
      ? {
          id: trophy.owner.id,
          name: trophy.owner.name,
          avatar: trophy.owner.avatar,
          vanityUrl: trophy.owner.vanityUrl,
        }
      : null,
    createdAt: trophy.createdAt,
  }));
}

async function buildSocialProfileInfo({ reqUserId, userId, userDoc, isSelf }) {
  const userMongoId = userDoc._id;
  const info = {
    groups: [],
    maxFriendsPage: Math.ceil((userDoc.numFriends || 0) / constants.friendsPerPage) || 1,
    karmaInfo: null,
    friendRequests: [],
    love: {},
    currentLove: null,
    saved: false,
    isFriendRequested: false,
    isFriend: false,
    isLove: false,
    isMarried: false,
    pokeStatus: { status: "none" },
    pokesDisabled: (!isSelf && userDoc.settings?.disablePokes) || false,
    incomingPokes: [],
    status: "offline",
    inGame: null,
    vanityUrl: undefined,
    family: null,
  };

  const basicInfo = await redis.getBasicUserInfo(userId);
  info.groups = basicInfo?.groups || [];

  if (!userDoc.settings?.hideKarma) {
    const karmaInfo = { voteCount: userDoc.karma, vote: 0 };
    const karmaVote = await models.KarmaVote.findOne({
      voterId: reqUserId,
      targetId: userId,
    }).lean();
    if (karmaVote) karmaInfo.vote = karmaVote.direction;
    info.karmaInfo = karmaInfo;
  }

  if (isSelf) {
    const friendRequests = await models.FriendRequest.find({ targetId: userId })
      .select("userId user")
      .populate("user", "id name avatar")
      .lean();
    const requestUserIds = friendRequests
      .map((request) => request.user?.id)
      .filter(Boolean);
    const vanityUrls = await models.VanityUrl.find({
      userId: { $in: requestUserIds },
    })
      .select("userId url -_id")
      .lean();
    const vanityUrlMap = new Map(
      vanityUrls.map((item) => [item.userId, item.url])
    );

    info.friendRequests = friendRequests
      .filter((request) => request.user)
      .map((request) => ({
        ...request.user,
        vanityUrl: vanityUrlMap.get(request.user.id),
      }));
  }

  const inGame = await redis.inGame(userId);
  info.inGame = inGame;

  const love = await models.Love.findOne({ userId })
    .select("loveId type")
    .populate({
      path: "love",
      select: "id name avatar -_id",
    });

  if (love !== null) {
    const loveJson = love.toJSON();
    loveJson.love.type = loveJson.type;
    info.love = loveJson.love;

    if (!isSelf && info.love.type === "Lover") {
      const docSave = await models.DocSave.find({
        $or: [
          { $and: [{ userId: userId }, { saverId: reqUserId }] },
          { $and: [{ userId: reqUserId }, { saverId: userId }] },
        ],
      }).lean();
      if (docSave.length > 0) info.saved = true;
    }
  }

  if (reqUserId) {
    info.currentLove = await models.Love.findOne({ userId: reqUserId })
      .select("userId loveId type -_id")
      .lean();
  }

  if (reqUserId) {
    info.isFriendRequested =
      (await models.FriendRequest.findOne({
        userId: reqUserId,
        targetId: userId,
      }).select("_id")) != null;

    info.isFriend =
      (await models.Friend.findOne({
        userId: reqUserId,
        friendId: userId,
      }).select("_id")) != null;
  }

  if (reqUserId && !isSelf && info.isFriend) {
    const pair = pokePairIds(reqUserId, userId);
    const poke = await models.Poke.findOne(pair).lean();
    if (poke) {
      if (poke.status === "pending" && !isPokeExpired(poke)) {
        info.pokeStatus =
          poke.to === reqUserId
            ? { status: "pending_received", count: poke.count }
            : { status: "pending_sent", count: poke.count };
      } else if (
        poke.status === "dismissed" &&
        isDismissCooldownActive(poke) &&
        poke.from === reqUserId
      ) {
        info.pokeStatus = { status: "cooldown" };
      }
    }
  }

  if (Object.keys(info.love).length !== 0) {
    if (info.love.type === "Married") {
      info.isMarried = true;
    } else if (info.love.type === "Lover") {
      if (reqUserId) {
        info.isMarried =
          (await models.LoveRequest.findOne({
            userId: reqUserId,
            targetId: userId,
            type: "Married",
          }).select("_id")) != null;
      }
      if (!info.isMarried) info.isLove = true;
    }
  } else if (reqUserId) {
    info.isLove =
      (await models.LoveRequest.findOne({
        userId: reqUserId,
        targetId: userId,
        type: "Lover",
      }).select("_id")) != null;
  }

  info.status = await redis.getUserStatus(userId);

  const vanityUrl = await models.VanityUrl.findOne({
    userId: userId,
  })
    .select("url -_id")
    .lean();
  if (vanityUrl) info.vanityUrl = vanityUrl.url;

  const inFamily = await models.InFamily.findOne({
    user: userMongoId,
  }).populate({
    path: "family",
    select: "id name avatar avatarUrl -_id",
  });

  if (inFamily && inFamily.family) {
    info.family = {
      id: inFamily.family.id,
      name: inFamily.family.name,
      avatar: inFamily.family.avatarUrl || inFamily.family.avatar,
    };
  }

  if (isSelf) {
    const incomingPokes = await models.Poke.find({
      to: userId,
      status: "pending",
    }).lean();
    const senderIds = incomingPokes
      .filter((poke) => !isPokeExpired(poke))
      .map((poke) => poke.from);
    const senders = await models.User.find({
      id: { $in: senderIds },
      deleted: false,
    })
      .select("id name avatar settings -_id")
      .lean();
    const senderMap = new Map(senders.map((sender) => [sender.id, sender]));

    info.incomingPokes = incomingPokes
      .filter((poke) => !isPokeExpired(poke))
      .map((poke) => {
        const sender = senderMap.get(poke.from);
        if (!sender || sender.settings?.disablePokes) return null;
        return {
          from: { id: sender.id, name: sender.name, avatar: sender.avatar },
          count: poke.count,
          updatedAt: poke.updatedAt,
        };
      })
      .filter(Boolean);
  }

  return info;
}

const mongo = require("mongodb");
const ObjectID = mongo.ObjectID;

const youtubeRegex =
  /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]{11}).*/;
const soundcloudRegex = /^https?:\/\/(www\.)?soundcloud\.com\/[^\/]+\/[^\/\?]+/;
const spotifyRegex =
  /^https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/[a-zA-Z0-9]+/;
const vimeoRegex = /^https?:\/\/(www\.)?vimeo\.com\/(\d+)/;
const invidiousRegex =
  /^https?:\/\/(www\.)?(invidious\.io|yewtu\.be|invidious\.flokinet\.to|invidious\.nixnet\.xyz|invidious\.privacydev\.net|invidious\.kavin\.rocks|invidious\.tux\.pizza|invidious\.projectsegfau\.lt|invidious\.riverside\.rocks|invidious\.busa\.co|invidious\.tinfoil-hat\.net|invidious\.jotoma\.de|invidious\.fdn\.fr|invidious\.mastodon\.host|invidious\.lelux\.fi|invidious\.mint\.lgbt|invidious\.fdn\.fr|invidious\.lelux\.fi|invidious\.mint\.lgbt|invidious\.nixnet\.xyz|invidious\.privacydev\.net|invidious\.kavin\.rocks|invidious\.tux\.pizza|invidious\.projectsegfau\.lt|invidious\.riverside\.rocks|invidious\.busa\.co|invidious\.tinfoil-hat\.net|invidious\.jotoma\.de|invidious\.fdn\.fr|invidious\.mastodon\.host|invidious\.lelux\.fi|invidious\.mint\.lgbt)\/watch\?v=([a-zA-Z0-9_-]{11})/;

router.get("/info", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);

    if (!userId) {
      res.send({});
      return;
    }

    var user = await redis.getUserInfo(userId);

    if (!user) {
      res.send({});
      return;
    }

    user.csrf = req.session.user.csrf;
    user.inGame = await redis.inGame(user.id);
    user.perms = (await redis.getUserPermissions(userId)) || {};
    user.rank = String(user.perms.rank || 0);
    user.perms = user.perms.perms || {};
    user.admin = Boolean(user.admin);
    delete user.status;

    res.send(user);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading user info");
  }
});

router.get("/me/favorite-roles", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId, deleted: false })
      .select("favoriteRoles -_id")
      .lean();
    res.send(user?.favoriteRoles ?? []);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading favorite roles.");
  }
});

router.get("/daily-spin", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("coins lastDailySpinAt -_id")
      .lean();

    if (!user) {
      res.status(404).send("User not found.");
      return;
    }

    res.send({
      ...getDailySpinAvailability(user.lastDailySpinAt),
      coins: Number(user.coins || 0),
      rewards: getPublicDailySpinRewards(),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading daily spin.");
  }
});

router.post("/daily-spin", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    if (!(await routeUtils.rateLimit(userId, "dailySpin", res))) return;

    const now = Date.now();
    const todayStart = getUtcDayStart(now);
    const reward = pickDailySpinReward();

    const spinResult = await models.User.updateOne(
      {
        id: userId,
        deleted: false,
        $or: [
          { lastDailySpinAt: { $lt: todayStart } },
          { lastDailySpinAt: { $exists: false } },
          { lastDailySpinAt: null },
        ],
      },
      {
        $inc: { coins: reward.coins },
        $set: { lastDailySpinAt: now },
      }
    ).exec();

    const changed =
      spinResult.modifiedCount ??
      spinResult.nModified ??
      spinResult.matchedCount ??
      0;

    if (!changed) {
      const user = await models.User.findOne({ id: userId, deleted: false })
        .select("lastDailySpinAt -_id")
        .lean();
      const availability = getDailySpinAvailability(user?.lastDailySpinAt, now);

      res.status(400).send({
        ...availability,
        message: "You have already used today's daily spin.",
        rewards: getPublicDailySpinRewards(),
      });
      return;
    }

    await redis.cacheUserInfo(userId, true);

    const updatedUser = await models.User.findOne({ id: userId, deleted: false })
      .select("coins lastDailySpinAt -_id")
      .lean();
    const availability = getDailySpinAvailability(
      updatedUser?.lastDailySpinAt,
      now
    );

    res.send({
      success: true,
      reward: reward.coins,
      rewardIndex: reward.index,
      coins: Number(updatedUser?.coins || 0),
      ...availability,
      rewards: getPublicDailySpinRewards(),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error using daily spin.");
  }
});

router.post("/role-favorite", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var roleId = String(req.body.id || "").trim();
    if (!roleId || !roleId.includes(":")) {
      res.status(400);
      res.send("Invalid role id.");
      return;
    }
    if (!(await routeUtils.rateLimit(userId, "favRole", res))) return;

    var user = await models.User.findOne({ id: userId, deleted: false })
      .select("favoriteRoles -_id");
    if (!user) {
      res.status(500);
      res.send("User not found.");
      return;
    }
    var list = user.favoriteRoles || [];
    var idx = list.indexOf(roleId);
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      if (list.length >= (constants.maxFavRoles || 100)) {
        res.status(400);
        res.send(
          "You may only favorite a maximum of " +
            (constants.maxFavRoles || 100) +
            " roles."
        );
        return;
      }
      list.push(roleId);
    }
    await models.User.updateOne(
      { id: userId },
      { $set: { favoriteRoles: list } }
    );
    res.send(list);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error favoriting role.");
  }
});

router.get("/leaderboard", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var leadingKarmaUsers = await redis.getLeaderBoardStat("karma");
    var leadingKudosUsers = await redis.getLeaderBoardStat("kudos");
    var leadingStatsUsers = await redis.getLeaderBoardStat("winRate");
    var leadingAchievementUsers = await redis.getLeaderBoardStat(
      "achievementCount"
    );
    var leadingDailyChallengesUsers = await redis.getLeaderBoardStat(
      "dailyChallengesCompleted"
    );

    res.send({
      leadingKarmaUsers: leadingKarmaUsers,
      leadingKudosUsers: leadingKudosUsers,
      leadingStatsUsers: leadingStatsUsers,
      leadingAchievementUsers: leadingAchievementUsers,
      leadingDailyChallengesUsers: leadingDailyChallengesUsers,
    });
  } catch (e) {
    logger.error(e);
    res.send([]);
  }
});

router.get("/searchName", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var query = routeUtils.strParseAlphaNum(req.query.query);
    var users = await models.User.find({
      name: new RegExp(query, "i"),
      deleted: false,
    })
      .select("id name avatar -_id")
      .limit(constants.mainUserSearchAmt)
      .sort("name");
    users = users.map((user) => user.toJSON());

    for (let user of users) user.status = await redis.getUserStatus(user.id);

    res.send(users);
  } catch (e) {
    logger.error(e);
    res.send([]);
  }
});

router.get("/online", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var users = await redis.getOnlineUsersInfo(100);
    res.send(users);
  } catch (e) {
    logger.error(e);
    res.send([]);
  }
});

router.get("/newest", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var last = Number(req.query.last);
    var first = Number(req.query.first);

    var users = await routeUtils.modelPageQuery(
      models.User,
      {},
      "joined",
      last,
      first,
      "id name avatar joined -_id",
      constants.newestUsersPageSize
    );

    res.send(users);
  } catch (e) {
    logger.error(e);
    res.send([]);
  }
});

router.get("/flagged", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var last = Number(req.query.last);
    var first = Number(req.query.first);
    var perm = "viewFlagged";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) return;

    var users = await routeUtils.modelPageQuery(
      models.User,
      { flagged: true },
      "joined",
      last,
      first,
      "id name avatar joined -_id",
      constants.newestUsersPageSize
    );

    res.send(users);
  } catch (e) {
    logger.error(e);
    res.send([]);
  }
});

router.post("/online", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);

    if (userId) redis.updateUserOnline(userId);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.sendStatus(200);
  }
});

router.get("/:id/gamePoints", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("pointsByGameCatalog -_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send({
      pointsByGameCatalog: await buildPointCatalogBalances(
        user.pointsByGameCatalog
      ),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load game points.");
  }
});

router.get("/:id/stats", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("settings stats -_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send({
      stats: user.settings?.hideStatistics ? null : buildUserStats(user.stats),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load stats.");
  }
});

router.get("/:id/purchasedItems", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("itemsOwned nameChanged -_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send({
      purchasedItems: await buildPurchasedItems(user.itemsOwned, user),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load purchased items.");
  }
});

router.get("/:id/emoteGroups", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("emoteGroupsOwned -_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const ownedKeys = user.emoteGroupsOwned || [];
    const emoteGroups = ownedKeys.length
      ? await models.EmoteGroup.find({ key: { $in: ownedKeys } })
          .select("key name imageUrl sortOrder -_id")
          .lean()
      : [];

    const sortedEmoteGroups = emoteGroups.sort(
      (a, b) =>
        Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
        String(a.name || a.key).localeCompare(String(b.name || b.key))
    );

    res.send({
      emoteGroups: sortedEmoteGroups.map((group) => ({
        ...group,
        emotes: buildEmoteGroupAssets(group.key),
      })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load emote groups.");
  }
});

router.get("/:id/archivedGames", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send({
      archivedGames: await buildArchivedGames(user._id),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load archived games.");
  }
});

router.get("/:id/scrapbook", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const reqUserId = await routeUtils.verifyLoggedIn(req, true);
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send(await buildScrapbookInfo(userId, reqUserId === userId));
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load scrapbook.");
  }
});

router.get("/:id/trophies", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send({
      trophies: await buildTrophies(userId),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load trophies.");
  }
});

router.get("/:id/social", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const reqUserId = await routeUtils.verifyLoggedIn(req, true);
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("_id id settings karma numFriends")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    res.send(
      await buildSocialProfileInfo({
        reqUserId,
        userId,
        userDoc: user,
        isSelf: reqUserId === userId,
      })
    );
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load social profile info.");
  }
});

router.get("/:id/profile", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var reqUserId = await routeUtils.verifyLoggedIn(req, true);
    var userId = String(req.params.id);

    // First try to find user by ID
    var userById = await models.User.findOne({
      id: userId,
      deleted: false,
    }).select("id -_id");

    // If not found by ID, try to find by vanity URL
    if (!userById) {
      const vanityUrl = await models.VanityUrl.findOne({
        url: userId,
      }).select("userId -_id");

      if (!vanityUrl) {
        // Check if this was a recently deleted vanity URL
        const deletedVanityUserId = await redis.getDeletedVanityUrlUserId(
          userId
        );
        if (deletedVanityUserId) {
          // Redirect to the user's ID instead
          userId = deletedVanityUserId;
        } else {
          res.status(404);
          res.send("User not found.");
          return;
        }
      } else {
        const userByVanity = await models.User.findOne({
          id: vanityUrl.userId,
          deleted: false,
        }).select("id -_id");

        if (!userByVanity) {
          res.status(404);
          res.send("User not found.");
          return;
        }

        userId = userByVanity.id;
      }
    }

    var isSelf = reqUserId == userId;
    var user = await models.User.findOne({ id: userId, deleted: false })
      .select(
        "id name avatar profileBackground settings accounts wins losses kudos points pointsNegative championshipPoints coins balanceDollar achievements bio pronouns banner numFriends lastActive joined favoriteRoles roleIconCredits _id"
      );

    if (!user) {
      res.status(500);
      res.send("Unable to load profile info.");
      return;
    }

    user = user.toJSON();
    user.avatar = (await resolveAvatarImageUrl(user)) || user.avatar;
    user.maxFriendsPage =
      Math.ceil(user.numFriends / constants.friendsPerPage) || 1;

    delete user._id;
    user.achievements = user.achievements;

    if (!user.settings) user.settings = {};

    if (user.settings.hidePointsNegative) {
      delete user.pointsNegative;
    }
    if (!isSelf) {
      delete user.coins;
      delete user.balanceDollar;
    }
    // Hide join date if user has setting enabled, unless viewer is the profile owner or has seeModPanel permission
    if (user.settings.hideJoinDate && reqUserId && !isSelf) {
      const hasPermission = await redis.hasPermission(reqUserId, "seeModPanel");
      if (!hasPermission) {
        delete user.joined;
      }
    }

    res.send(user);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load profile info.");
  }
});

router.post("/karma", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var targetId = String(req.body.targetId);
    var perm = "vote";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) {
      return;
    }

    var user = await models.User.findOne({
      id: targetId,
      deleted: false,
    }).select("-_id");

    if (!user) {
      res.status(500);
      res.send("Unable to find user.");
      return;
    }

    if (targetId === userId) {
      res.status(500);
      res.send("Cannot vote for yourself.");
      return;
    }

    if (!(await routeUtils.rateLimit(userId, "vote", res))) return;

    var direction = Number(req.body.direction);

    if (direction != 1 && direction != -1) {
      res.status(500);
      res.send("Bad vote direction");
      return;
    }

    var vote = await models.KarmaVote.findOne({
      voterId: userId,
      targetId: targetId,
    });

    if (!vote) {
      vote = new models.KarmaVote({
        voterId: userId,
        targetId: targetId,
        direction: direction,
      });
      await vote.save();

      await models.User.updateOne(
        { id: targetId },
        { $inc: { karma: direction } }
      ).exec();

      res.send(String(direction));
    } else if (vote.direction != direction) {
      await models.KarmaVote.updateOne(
        { voterId: userId, targetId: targetId },
        { $set: { direction: direction } }
      ).exec();

      await models.User.updateOne(
        { id: targetId },
        { $inc: { karma: 2 * direction } }
      ).exec();

      res.send(String(direction));
    } else {
      await models.KarmaVote.deleteOne({
        voterId: userId,
        targetId: targetId,
      }).exec();

      await models.User.updateOne(
        { id: targetId },
        { $inc: { karma: -1 * direction } }
      ).exec();

      res.send("0");
    }
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error voting.");
  }
});

router.get("/:id/love", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const identifier = String(req.params.id);
    const userId = await resolveUserId(identifier);

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    var love = await models.Love.findOne({ userId })
      .select("loveId type")
      .populate({
        path: "love",
        select: "id name avatar -_id",
      });

    if (love) {
      love = love.toJSON();
      love.love.type = love.type;

      res.send(love.love);
    } else {
      res.send({});
    }
  } catch (e) {
    logger.error(e);
    res.send("Unable to load love.");
  }
});

router.get("/:id/friends", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const identifier = String(req.params.id);
    const userId = await resolveUserId(identifier);

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    var last = Number(req.query.last);
    var first = Number(req.query.first);

    var friends = await routeUtils.modelPageQuery(
      models.Friend,
      { userId },
      "lastActive",
      last,
      first,
      "friendId friend lastActive -_id",
      constants.friendsPerPage,
      ["friend", "id name avatar -_id"]
    );

    friends = await Promise.all(
      friends.map(async (friend) => {
        friend = friend.toJSON();

        // Get vanity URL for friend
        const vanityUrlObj = await models.VanityUrl.findOne({
          userId: friend.friendId,
        }).select("url -_id");

        let vanityUrl = null;
        if (vanityUrlObj) {
          vanityUrl = vanityUrlObj.url;
        }

        return {
          ...friend.friend,
          lastActive: friend.lastActive,
          vanityUrl: vanityUrl,
        };
      })
    );

    res.send(friends);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load friends.");
  }
});

router.get("/:id/pointsHistory", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await resolveUserId(String(req.params.id));

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const requestedPage = Math.max(1, Number(req.query.page || 1));
    const requestedPageSize = Math.max(1, Number(req.query.pageSize || 10));
    const pageSize = Math.min(requestedPageSize, 50);

    const total = await models.PointsHistory.countDocuments({ userId });
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const skip = (page - 1) * pageSize;

    const items = await models.PointsHistory.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select(
        "gameId gameType gameCatalogKey gameCatalogTitle amount reason description createdAt meta"
      )
      .lean();

    res.send({
      items,
      page,
      pageSize,
      pages,
      total,
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load points history.");
  }
});

router.get("/:id/setups", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const identifier = String(req.params.id);
    const userId = await resolveUserId(identifier);

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const pageSize = constants.userSetupsPerPage || 5;
    const requestedPage = Number(req.query.page) || 1;

    const userDoc = await models.User.findOne({
      id: userId,
      deleted: false,
    }).select("setups");

    if (!userDoc) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const total = userDoc.setups?.length || 0;
    const maxPage = Math.max(Math.ceil(total / pageSize), 1);
    const sanitizedPage = Math.min(Math.max(requestedPage, 1), maxPage);
    const startIdx = (sanitizedPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const subsetIds = (userDoc.setups || []).slice(startIdx, endIdx);

    let setups = [];

    if (subsetIds.length > 0) {
      const fetchedSetups = await models.Setup.find({
        _id: { $in: subsetIds },
      })
        .select(
          "id gameType name closed useRoleGroups roleGroupSizes count roles total"
        )
        .lean();

      const setupMap = new Map(
        fetchedSetups.map((setup) => [String(setup._id), setup])
      );

      setups = subsetIds
        .map((id) => setupMap.get(String(id)))
        .filter(Boolean)
        .map((setup) => {
          const { _id, ...rest } = setup;
          return rest;
        });
    }

    res.send({
      setups,
      page: sanitizedPage,
      pages: maxPage,
      total,
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load setups.");
  }
});

router.get("/:id/games", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const identifier = String(req.params.id);
    const userId = await resolveUserId(identifier);

    if (!userId) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const pageSize = constants.userGamesPerPage || 5;
    const requestedPage = Number(req.query.page) || 1;

    const userDoc = await models.User.findOne({
      id: userId,
      deleted: false,
    }).select("_id");

    if (!userDoc) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const userMongoId = userDoc._id;

    const total = await models.Game.countDocuments({
      users: userMongoId,
    });

    const maxPage = Math.max(Math.ceil(total / pageSize), 1);
    const sanitizedPage = Math.min(Math.max(requestedPage, 1), maxPage);
    const skip = (sanitizedPage - 1) * pageSize;

    let games = [];

    if (total > 0) {
      games = await models.Game.find({
        users: userMongoId,
      })
        .sort("-endTime")
        .skip(skip)
        .limit(pageSize)
        .select(
          "id setup lobby endTime private broken ranked competitive spectating anonymousGame status users players winners"
        )
        .populate({
          path: "setup",
          select:
            "id gameType name closed useRoleGroups roleGroupSizes count roles total -_id",
        })
        .lean();

      games = games.map((game) => {
        let won = null;
        if (!game.broken && game.winners && game.winners.length > 0) {
          const userIdx = (game.users || []).findIndex(
            (u) => u && u.toString() === userMongoId.toString()
          );
          if (userIdx !== -1 && game.players && game.players[userIdx]) {
            won = game.winners.includes(game.players[userIdx]);
          }
        }
        const { users, players, winners, ...rest } = game;
        return { ...rest, won, status: game.status || "Finished" };
      });
    }

    if (sanitizedPage === 1) {
      const currentGame = await getPublicCurrentGame(userId);
      if (currentGame) games.unshift(currentGame);
    }

    res.send({
      games,
      page: sanitizedPage,
      pages: maxPage,
      total,
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to load games.");
  }
});

router.get("/:id/reports", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const reqUserId = await routeUtils.verifyLoggedIn(req, true);
    const identifier = String(req.params.id);
    const profileUserId = await resolveUserId(identifier);
    let isModViewer = false;

    if (!profileUserId) {
      res.status(404).send("User not found.");
      return;
    }

    // Check permissions: user must be viewing their own profile OR have seeModPanel permission
    if (reqUserId !== profileUserId) {
      if (!reqUserId) {
        res.status(401).send("You must be logged in to view reports.");
        return;
      }
      if (!(await routeUtils.verifyPermission(res, reqUserId, "seeModPanel"))) {
        return;
      }
      isModViewer = true;
    } else if (reqUserId) {
      // Mods viewing their own profile should still see linked-account history.
      isModViewer = await redis.hasPermission(reqUserId, "seeModPanel");
    }

    const reportUserIds = isModViewer
      ? Array.from(new Set(await routeUtils.getAltAccountIds(profileUserId)))
      : [profileUserId];

    // Fetch all completed reports for this user (including dismissed).
    // For mods, include reports across linked accounts.
    const reports = await models.Report.find({
      reportedUserId: { $in: reportUserIds },
      status: "complete",
    })
      .sort({ completedAt: -1 })
      .lean()
      .select(
        "id status completedAt finalRuling rule description createdAt reporterId gameId linkedViolationTicketId reportedUserId"
      );

    // Fetch all violation tickets for this user (excluding appealed ones).
    // For mods, include tickets across linked accounts.
    const violationTickets = await models.ViolationTicket.find({
      userId: { $in: reportUserIds },
      $or: [{ appealed: { $exists: false } }, { appealed: false }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Create a map of violation ticket ID to violation ticket
    const violationMap = {};
    const now = Date.now();
    for (const ticket of violationTickets) {
      violationMap[ticket.id] = {
        ...ticket,
        status:
          !ticket.activeUntil || ticket.activeUntil === 0
            ? "permanent"
            : ticket.activeUntil > now
            ? "active"
            : "expired",
      };
    }

    // Populate reporter names and add violation ticket info to reports
    const { getBasicUserInfo } = require("../modules/redis");
    for (const report of reports) {
      try {
        const reportedUserInfo = await getBasicUserInfo(report.reportedUserId);
        if (reportedUserInfo) {
          report.reportedUserName = reportedUserInfo.name;
          report.reportedUserAvatar = reportedUserInfo.avatar;
        }

        const reporterInfo = await getBasicUserInfo(report.reporterId);
        if (reporterInfo) {
          report.reporterName = reporterInfo.name;
        }

        // Add violation ticket info if linked
        if (
          report.linkedViolationTicketId &&
          violationMap[report.linkedViolationTicketId]
        ) {
          report.violationTicket = violationMap[report.linkedViolationTicketId];
        }
        report.isLinkedAccountReport = report.reportedUserId !== profileUserId;
      } catch (e) {
        // Ignore errors fetching reporter info
      }
    }

    res.send({
      reports,
      linkedAccountIds: isModViewer ? reportUserIds : [profileUserId],
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading reports.");
  }
});

router.get("/:id/info", async function (req, res) {
  try {
    const identifier = String(req.params.id);
    const userId = await resolveUserId(identifier);

    if (!userId) {
      res.status(404);
      res.send({
        name: "[not found]",
        avatar: false,
      });
      return;
    }

    var user = await redis.getUserInfo(userId);

    if (!user) {
      res.status(404);
      res.send({
        name: "[not found]",
        avatar: false,
      });
      return;
    }

    user.csrf = req.session.user.csrf;
    user.inGame = await redis.inGame(user.id);
    user.perms = (await redis.getUserPermissions(req.params.id)) || {};
    user.rank = String(user.perms.rank || 0);
    user.perms = user.perms.perms || {};

    // Get online status and last active time
    user.status = await redis.getUserStatus(user.id);
    const userDoc = await models.User.findOne({ id: user.id }).select(
      "lastActive -_id"
    );
    user.lastActive = userDoc?.lastActive;

    res.send(user);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error getting user");
  }
});

router.get("/:id/nameHistory", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var reqUserId = await routeUtils.verifyLoggedIn(req, true);
    var userId = String(req.params.id);

    // Only admins and moderators can view name history
    if (reqUserId) {
      const hasPermission = await redis.hasPermission(reqUserId, "seeModPanel");
      if (!hasPermission) {
        res.status(403);
        res.send("You do not have permission to view name history.");
        return;
      }
    } else {
      res.status(401);
      res.send("You must be logged in to view name history.");
      return;
    }

    // Resolve userId (could be ID or vanity URL)
    const userById = await models.User.findOne({
      id: userId,
      deleted: false,
    }).select("id -_id");

    if (!userById) {
      const vanityUrl = await models.VanityUrl.findOne({
        url: userId,
      }).select("userId -_id");

      if (vanityUrl) {
        const userByVanity = await models.User.findOne({
          id: vanityUrl.userId,
          deleted: false,
        }).select("id -_id");

        if (userByVanity) {
          userId = userByVanity.id;
        } else {
          res.status(404);
          res.send("User not found.");
          return;
        }
      } else {
        res.status(404);
        res.send("User not found.");
        return;
      }
    }

    // Get user with name history
    const user = await models.User.findOne({
      id: userId,
      deleted: false,
    })
      .select("id name previousNames -_id")
      .lean();

    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    // Format name history: include current name and all previous names
    const nameHistory = [];

    // Add current name first
    nameHistory.push({
      name: user.name,
      changedAt: null, // Current name has no change date
      isCurrent: true,
    });

    // Add previous names in reverse chronological order (newest first)
    if (user.previousNames && user.previousNames.length > 0) {
      const sortedPreviousNames = [...user.previousNames].sort(
        (a, b) => (b.changedAt || 0) - (a.changedAt || 0)
      );
      sortedPreviousNames.forEach((prevName) => {
        nameHistory.push({
          name: prevName.name,
          changedAt: prevName.changedAt,
          isCurrent: false,
        });
      });
    }

    res.send(nameHistory);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading name history.");
  }
});

router.get("/settings/data", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);
    var user =
      userId &&
      (await models.User.findOne({ id: userId, deleted: false })
        .select("name birthday pronouns settings customEmotes -_id")
        .populate({
          path: "customEmotes",
          select: "id extension name -_id",
        }));

    if (user) {
      user = user.toJSON();

      if (!user.settings) user.settings = {};

      user.settings.username = user.name;
      user.settings.pronouns = user.pronouns;
      user.birthday = Date.parse(user.birthday);

      // Fetch vanity URL
      const vanityUrl = await models.VanityUrl.findOne({
        userId: userId,
      }).select("url -_id");

      if (vanityUrl) {
        user.settings.vanityUrl = vanityUrl.url;
      }

      res.send(user.settings);
    } else res.send({});
  } catch (e) {
    logger.error(e);
    res.send("Unable to load settings");
  }
});

router.get("/accounts", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);
    var user =
      userId &&
      (await models.User.findOne({ id: userId, deleted: false }).select(
        "accounts -_id"
      ));

    if (user) res.send(user.accounts);
    else res.send({});
  } catch (e) {
    logger.error(e);
    res.send("Unable to load settings");
  }
});

router.post("/youtube", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    let userId = await routeUtils.verifyLoggedIn(req);
    let prop = String(req.body.prop);
    let value = String(req.body.link);

    if (value.length > 200) {
      throw new Error("URL is too long");
    }

    let matches = value.match(youtubeRegex);
    let soundcloudMatches = value.match(soundcloudRegex);
    let spotifyMatches = value.match(spotifyRegex);
    let vimeoMatches = value.match(vimeoRegex);
    let invidiousMatches = value.match(invidiousRegex);
    let directMediaMatches = value.match(
      /^https?:\/\/.*?\.(ogg|mp3|mp4|webm)$/
    );
    let emptyMatches = value.match(/^$/g);

    if (matches) {
      let embedId = 0;
      if (matches && matches.length >= 7) {
        embedId = matches[7];
      }
      let embedIndex = value.indexOf(embedId);

      // Youtube video IDs are 11 characters, so get the substring,
      // & end at the end of the found embedID.
      value = value.substring(0, embedIndex + 11);

      await models.User.updateOne(
        { id: userId },
        { $set: { [`settings.youtube`]: value } }
      );
    } else if (
      soundcloudMatches ||
      spotifyMatches ||
      vimeoMatches ||
      invidiousMatches ||
      directMediaMatches ||
      emptyMatches
    ) {
      await models.User.updateOne(
        { id: userId },
        { $set: { [`settings.youtube`]: value } }
      );
    } else {
      throw new Error("Invalid URL");
    }

    await redis.cacheUserInfo(userId, true);
    res.send("Media updated successfully.");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating media.");
  }
});

router.post("/deathMessage", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    let userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId, deleted: false }).select(
      "name"
    );

    var itemsOwned = await redis.getUserItemsOwned(userId);
    let deathMessage = String(req.body.deathMessage);

    if (!itemsOwned.deathMessageEnabled) {
      res.status(500);
      res.send("You must purchase custom death messages from the Shop.");
      return;
    }

    if (itemsOwned.deathMessageChange < 1) {
      res.status(500);
      res.send(
        "You must purchase additional death messages changes from the Shop."
      );
      return;
    }

    // truncate to 150 chars
    if (deathMessage.length > 150) {
      deathMessage = deathMessage.substring(0, 150);
    }

    if (!deathMessage.includes("${name}")) {
      res.status(500);
      res.send(
        "You must use ${name} in the death message as a placeholder for your username."
      );
      return;
    }

    await models.User.updateOne(
      { id: userId },
      {
        $set: { [`settings.deathMessage`]: deathMessage },
        $inc: { "itemsOwned.deathMessageChange": -1 },
      }
    ).exec();
    await redis.cacheUserInfo(userId, true);
    res.send("Death message updated successfully");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating death message.");
  }
});

// Vanity URL routes moved to /api/vanityUrl

router.post("/customEmote/create", async function (req, res) {
  try {
    await routeUtils.verifyLoggedIn(req);
    res.status(410);
    res.send("Custom emote uploads are disabled. Buy emotes from the Shop.");
    return;
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to make custom emote.");
  }
});

router.post("/customEmote/delete", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    let customEmoteId = String(req.body.id);

    let customEmote = await models.CustomEmote.findOne({
      id: customEmoteId,
      deleted: false,
    })
      .select("_id id extension name creator")
      .populate([
        {
          path: "creator",
          model: "User",
          select: "id -_id",
        },
      ]);

    if (!customEmote || customEmote.creator.id != userId) {
      res.status(500);
      res.send("You can only delete custom emotes you have created.");
      return;
    }

    if (String(customEmote.id || "").startsWith("emote-")) {
      res.status(400);
      res.send("Purchased emotes cannot be deleted.");
      return;
    }

    // not sure if user custom emotes should be removed or not in case it needs to be cited for an offense
    //fs.rmSync(utils.getCustomEmoteFilepath(userId, customEmote.id, customEmote.extension));

    await models.CustomEmote.updateOne(
      { id: customEmoteId },
      { $set: { deleted: true } }
    ).exec();
    await models.User.updateOne(
      { id: customEmote.creator.id },
      { $pull: { customEmotes: customEmote._id } }
    ).exec();

    // Allow the deleted custom emote to be uncached
    redis.invalidateCachedUser(userId);

    res.send(`Deleted custom emote ${customEmote.name}`);
    return;
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Unable to delete custom emote.");
  }
});

router.post("/settings/update", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var prop = String(req.body.prop);
    var value = String(req.body.value);

    if (!routeUtils.validProp(prop)) {
      logger.warn(`Invalid settings prop by ${userId}: ${prop}`);
      res.status(500);
      res.send("Error updating settings.");
      return;
    }

    if (prop === "siteColorScheme" && isRetroThemeForcedByCalendar()) {
      res.status(403);
      res.send("Site color scheme is locked on this date.");
      return;
    }

    var itemsOwned = await redis.getUserItemsOwned(userId);

    if (
      (prop == "backgroundColor" || prop == "bannerFormat") &&
      !itemsOwned.customProfile
    ) {
      res.status(500);
      res.send(
        "You must purchase profile customization with coins from the Shop."
      );
      return;
    }

    if (prop == "avatarShape" && !itemsOwned.avatarShape) {
      res.status(500);
      res.send("You must purchase Square with coins from the Shop.");
      return;
    }

    if (prop == "customPrimaryColor" && !itemsOwned.customPrimaryColor) {
      res.status(500);
      res.send(
        "You must purchase Custom Site Primary Color with coins from the Shop."
      );
      return;
    }

    if (prop == "iconFilter" && !itemsOwned.iconFilter) {
      res.status(500);
      res.send("You must purchase Icon Filter with coins from the Shop.");
      return;
    }

    if (prop == "backgroundRepeatMode" && !itemsOwned.profileBackground) {
      res.status(500);
      res.send(
        "You must purchase Profile Background with coins from the Shop."
      );
      return;
    }

    if (
      (prop == "textColor" || prop == "nameColor") &&
      !itemsOwned.textColors
    ) {
      res.status(500);
      res.send("You must purchase text colors with coins from the Shop.");
      return;
    }

    if (prop === "deathMessage") {
      // Truncate to 150 chars first
      if (value.length > 150) {
        value = value.substring(0, 150);
      }

      // Validate deathMessage includes ${name} placeholder (after truncation)
      if (!value.includes("${name}")) {
        res.status(500);
        res.send(
          "You must use ${name} in the death message as a placeholder for your username."
        );
        return;
      }
    }

    if (prop === "youtube") {
      // Validate URL length
      if (value.length > 200) {
        res.status(500);
        res.send("URL is too long");
        return;
      }

      // Validate URL against allowed patterns
      let matches = value.match(youtubeRegex);
      let soundcloudMatches = value.match(soundcloudRegex);
      let spotifyMatches = value.match(spotifyRegex);
      let vimeoMatches = value.match(vimeoRegex);
      let invidiousMatches = value.match(invidiousRegex);
      let directMediaMatches = value.match(
        /^https?:\/\/.*?\.(ogg|mp3|mp4|webm)$/
      );
      let emptyMatches = value.match(/^$/g);

      if (matches) {
        // For YouTube URLs, extract and truncate to just the video ID portion
        let embedId = 0;
        if (matches && matches.length >= 7) {
          embedId = matches[7];
        }
        let embedIndex = value.indexOf(embedId);
        // Youtube video IDs are 11 characters, so get the substring,
        // & end at the end of the found embedID.
        value = value.substring(0, embedIndex + 11);
      } else if (
        soundcloudMatches ||
        spotifyMatches ||
        vimeoMatches ||
        invidiousMatches ||
        directMediaMatches ||
        emptyMatches
      ) {
        // Valid URL for other allowed services or empty
        // value is already set, no need to modify
      } else {
        res.status(500);
        res.send("Error updating settings.");
        return;
      }
    }

    let unsetOperator = {};
    if (prop === "textColor") {
      unsetOperator = { $unset: { "settings.warnTextColor": "" } };
    }
    if (prop === "nameColor") {
      unsetOperator = { $unset: { "settings.warnNameColor": "" } };
    }
    await models.User.updateOne(
      { id: userId },
      { $set: { [`settings.${prop}`]: value }, ...unsetOperator }
    );
    await redis.cacheUserInfo(userId, true);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating settings.");
  }
});

router.post("/bio", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var bio = String(req.body.bio);
    var perm = "editBio";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) return;

    if (bio.length < constants.maxBioContentLength) {
      await models.User.updateOne({ id: userId }, { $set: { bio: bio } });
      res.sendStatus(200);
    } else if (bio.length >= constants.maxBioContentLength) {
      res.status(500);
      res.send(
        `Bio must be less than ${constants.maxBioContentLength} characters`
      );
    } else {
      res.status(500);
      res.send("Error editing bio");
    }
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error editing bio");
  }
});

router.post("/contributorBio", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var bio = String(req.body.bio || "");

    // Limit to 240 characters
    if (bio.length > 240) {
      res.status(500);
      res.send("Contributor bio must be 240 characters or less.");
      return;
    }

    await models.User.updateOne(
      { id: userId },
      { $set: { contributorBio: bio } }
    );
    await redis.cacheUserInfo(userId, true);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating contributor bio.");
  }
});

router.post("/pronouns", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var pronouns = String(req.body.pronouns);
    var perm = "editPronouns";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) return;

    if (pronouns.length < constants.maxPronounsContentLength) {
      await models.User.updateOne(
        { id: userId },
        { $set: { pronouns: pronouns } }
      );
      res.sendStatus(200);
    } else if (pronouns.length >= constants.maxPronounsContentLength) {
      res.status(500);
      res.send(
        `Pronouns must be less than ${constants.maxPronounsContentLength} characters`
      );
    } else {
      res.status(500);
      res.send("Error editing pronouns");
    }
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error editing pronouns");
  }
});

router.post("/avatar/equip", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const avatarKey = String(req.body.avatarKey || "").trim().toLowerCase();

    if (!avatarKey || !avatarKey.startsWith("avatar-")) {
      res.status(400);
      res.send("Invalid avatar key.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false }).select(
      "itemsOwned avatarsOwned settings -_id"
    );
    if (!user) {
      res.status(404);
      res.send("User not found.");
      return;
    }

    const ownsAvatar =
      (user.avatarsOwned || []).includes(avatarKey) ||
      Number(user.itemsOwned?.[avatarKey] || 0) > 0;
    if (!ownsAvatar) {
      res.status(400);
      res.send("You do not own this avatar.");
      return;
    }

    const avatarItem = await models.AvatarItem.findOne({ key: avatarKey })
      .select("key imageUrl -_id")
      .lean();
    if (!avatarItem?.imageUrl) {
      res.status(400);
      res.send("Avatar image is unavailable.");
      return;
    }

    await models.User.updateOne(
      { id: userId },
      {
        $set: {
          avatar: avatarItem.imageUrl,
          "settings.equippedAvatarKey": avatarKey,
        },
        $addToSet: {
          avatarsOwned: avatarKey,
        },
      }
    );
    await redis.cacheUserInfo(userId, true);

    res.send({ ok: true, avatarKey, avatar: avatarItem.imageUrl });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error equipping avatar.");
  }
});

router.post("/birthday", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    let userId = await routeUtils.verifyLoggedIn(req);
    var bdayChanged = await redis.getUserInfo(userId).nameChanged;
    var perm = "changeBday";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) {
      return;
    }

    if (bdayChanged) {
      res.status(500);
      res.send(
        "You have already changed your birthday. Please contact a moderator if you need to reset it."
      );
      return;
    }

    let value = String(req.body.date);
    await models.User.updateOne(
      { id: userId },
      {
        $set: { birthday: value, bdayChanged: true },
      }
    ).exec();
    await redis.cacheUserInfo(userId, true);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating birthday.");
  }
});

router.delete("/birthday", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    let userId = await routeUtils.verifyLoggedIn(req);

    await models.User.updateOne(
      { id: userId },
      {
        $unset: { birthday: "" },
        $set: { bdayChanged: false },
      }
    ).exec();
    await redis.cacheUserInfo(userId, true);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error clearing birthday.");
  }
});

router.post("/name", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var itemsOwned = await redis.getUserItemsOwned(userId);
    var name = String(req.body.name);
    var perm = "changeName";

    if (!(await routeUtils.verifyPermission(res, userId, perm))) return;

    if (name.length == 3 && !itemsOwned.threeCharName) {
      res.status(500);
      res.send(
        "You must purchase 3 character usernames with coins from the Shop."
      );
      return;
    }

    if (name.length == 2 && !itemsOwned.twoCharName) {
      res.status(500);
      res.send(
        "You must purchase 2 character usernames with coins from the Shop."
      );
      return;
    }

    if (name.length == 1 && !itemsOwned.oneCharName) {
      res.status(500);
      res.send(
        "You must purchase 1 character usernames with coins from the Shop."
      );
      return;
    }

    if (name.length < 1 || name.length > constants.maxUserNameLength) {
      res.status(500);
      res.send(
        `Names must be between 4 and ${constants.maxUserNameLength} characters.`
      );
      return;
    }

    if (!name.match(routeUtils.usernameRegex)) {
      res.status(500);
      res.send(
        "Names can only contain letters, numbers, and nonconsecutive undescores/hyphens."
      );
      return;
    }

    var existingUser = await models.User.findOne({
      name: new RegExp(`^${name}$`, "i"),
    }).select("_id");

    if (existingUser) {
      res.status(500);
      res.send("There is already a user with this name.");
      return;
    }

    // Get current user to record previous name
    const currentUser = await models.User.findOne({ id: userId }).select(
      "name"
    );
    const oldName = currentUser ? currentUser.name : null;

    // Update name and record previous name
    const updateQuery = {
      $set: { name: name, nameChanged: true },
      $inc: { "itemsOwned.nameChange": -1 },
    };

    // Add previous name to history if it exists and is different
    if (oldName && oldName !== name) {
      updateQuery.$push = {
        previousNames: {
          name: oldName,
          changedAt: Date.now(),
        },
      };
    }

    const updatedUser = await models.User.findOneAndUpdate(
      { id: userId, "itemsOwned.nameChange": { $gte: 1 } },
      updateQuery,
      { new: true }
    )
      .select("itemsOwned.nameChange")
      .lean();

    if (!updatedUser) {
      res.status(500);
      res.send(
        "You must purchase additional name changes with coins from the Shop."
      );
      return;
    }

    await redis.cacheUserInfo(userId, true);

    res.send({
      nameChange: Number(updatedUser.itemsOwned?.nameChange || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error changing username");
  }
});

router.post("/block", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var userIdToBlock = String(req.body.user);

    if (userId == userIdToBlock) {
      res.status(500);
      res.send("You cannot block yourself.");
      return;
    }

    var userToBlock = await models.User.findOne({ id: userIdToBlock }).select(
      "_id"
    );

    if (!userToBlock) {
      res.status(500);
      res.send("User not found.");
      return;
    }

    var user = await models.User.findOne({ id: userId }).select("blockedUsers");

    if (user.blockedUsers.indexOf(userIdToBlock) == -1) {
      await models.User.updateOne(
        { id: userId },
        { $push: { blockedUsers: userIdToBlock } }
      ).exec();
    } else {
      await models.User.updateOne(
        { id: userId },
        { $pull: { blockedUsers: userIdToBlock } }
      ).exec();
    }

    await redis.cacheUserInfo(userId, true);
    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error blocking user.");
  }
});

async function unlove(userId, userIdToLove) {
  await models.Love.deleteOne({ userId, loveId: userIdToLove }).exec();
  await models.Love.deleteOne({ userId: userIdToLove, loveId: userId }).exec();

  await models.User.updateMany(
    { id: { $in: [userId, userIdToLove] } },
    { love: "" }
  ).exec();

  await models.LoveRequest.deleteOne({ userId: userIdToLove }).exec();
  await models.LoveRequest.deleteOne({ userId: userId }).exec();

  return;
}

async function acceptLove(userId, userIdToLove, type, userName) {
  if (type === "Lover") {
    var love = new models.Love({
      userId: userId,
      loveId: userIdToLove,
      type: type,
    });
    await love.save();

    love = new models.Love({
      userId: userIdToLove,
      loveId: userId,
      type: type,
    });
    await love.save();

    await routeUtils.createNotification(
      {
        content: `${userName} accepted your love!`,
        icon: "fas fa-heart",
        link: `/user/${userId}`,
      },
      [userIdToLove]
    );
  }

  if (type === "Married") {
    await models.Love.updateOne(
      { userId: userIdToLove },
      { $set: { type: "Married" } }
    ).exec();
    await models.Love.updateOne(
      { userId: userId },
      { $set: { type: "Married" } }
    ).exec();

    await routeUtils.createNotification(
      {
        content: `${userName} accepted your marriage proposal!`,
        icon: "fas fa-ring",
        link: `/user/${userId}`,
      },
      [userIdToLove]
    );
  }

  await models.LoveRequest.deleteOne({ userId: userIdToLove }).exec();
  await models.LoveRequest.deleteOne({ userId: userId }).exec();

  await models.LoveRequest.deleteMany({
    $or: [{ userId: userId }, { loveId: userId }],
  }).exec();
}

router.post("/love", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var userName = await redis.getUserName(userId);
    var userIdToLove = String(req.body.user);

    var currentLove = String(req.body.type);
    var requestType = String(req.body.reqType);

    if (userId === userIdToLove) {
      res.status(500);
      res.send({
        message: "Self love is good, but the site doesn't work that way.",
        love: null,
      });
      return;
    }

    // Does the user have an active love request sent to a different user already?
    // SHOULD PROBABLY TELL THE USER ON FRONT END THAT SENDING REQUEST WILL CANCEL THEIR OTHER REQUESTS INSTEAD.
    var otherUserRequest = await models.LoveRequest.findOne({
      userId: userId,
    }).select("targetId type -_id");

    if (otherUserRequest !== null) {
      otherUserRequest = otherUserRequest.toJSON();

      if (otherUserRequest.targetId !== userIdToLove) {
        await models.LoveRequest.deleteOne({
          userId,
          targetId: userIdToLove,
        }).exec();
      }
    }

    var existingRequest = await models.LoveRequest.findOne({
      userId,
      targetId: userIdToLove,
    }).select("type -_id");

    // Cancel existing request
    if (existingRequest) {
      var cancelMessage = "";
      if (existingRequest.toJSON().type === "Married") {
        cancelMessage = "Marriage proposal cancelled.";
      } else {
        cancelMessage = "Love request cancelled.";
      }
      await models.LoveRequest.deleteOne({
        userId,
        targetId: userIdToLove,
      }).exec();
      res.send({ message: cancelMessage, love: null });
      return;
    }

    var existingLove = await models.Love.findOne({
      userId,
      loveId: userIdToLove,
    }).select("type _id");

    if (
      currentLove === "Married" &&
      existingLove.toJSON().type === "Married" &&
      requestType === "Marry"
    ) {
      await unlove(userId, userIdToLove, "Married");
      res.send({ message: "Divorced this user.", love: {} });
      return;
    } else {
      // Unlove
      if (
        existingLove !== null &&
        existingLove.toJSON().type === "Lover" &&
        currentLove === "Lover" &&
        requestType === "Love"
      ) {
        await unlove(userId, userIdToLove, "Lover");
        res.send({ message: "Broke up with this user.", love: {} });
        return;
      }
    }

    existingRequest = await models.LoveRequest.findOne({
      userId: userIdToLove,
      targetId: userId,
    }).select("type _id");

    // Accept existing request
    if (existingRequest) {
      var requestType = existingRequest.toJSON().type;

      await acceptLove(userId, userIdToLove, requestType, userName);
      var love = await models.Love.findOne({ userId: userIdToLove }).select(
        "loveId type"
      );

      if (love) {
        love = love.toJSON();

        var userLove = await models.User.findOne({ id: love.loveId }).select(
          "id name avatar -_id"
        );

        userLove = userLove.toJSON();
        userLove.type = love.type;

        if (requestType === "Lover") {
          res.send({ message: "Love request accepted!", love: userLove });
        } else if (requestType === "Married") {
          res.send({ message: "Marriage proposal accepted!", love: userLove });
        }
        return;
      }
    }

    var createRequestType, notifContent, image, response, err;
    if (currentLove === "Lover") {
      createRequestType = "Married";
      notifContent = `${userName} proposed marriage to you!`;
      image = "fas fa-ring";
      response = "Marriage proposal sent!";
      err = "Error sending marriage proposal";
    } else {
      createRequestType = "Lover";
      notifContent = `${userName} sent a love request!`;
      image = "fas fa-heart";
      response = "Love request sent!";
      err = "Error sending love request";
    }

    // Create new request
    var request = new models.LoveRequest({
      userId: userId,
      targetId: userIdToLove,
      type: createRequestType,
    });
    await request.save();

    await routeUtils.createNotification(
      {
        content: notifContent,
        icon: image,
        link: `/user/${userId}`,
      },
      [userIdToLove]
    );

    res.send({ message: response, requestType: createRequestType });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send(err);
  }
});

router.post("/friend", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var userName = await redis.getUserName(userId);
    var userIdToFriend = String(req.body.user);

    if (userId == userIdToFriend) {
      res.status(500);
      res.send("You cannot be friends with yourself.");
      return;
    }

    var existingRequest = await models.FriendRequest.findOne({
      userId,
      targetId: userIdToFriend,
    }).select("_id");

    // Cancel existing request
    if (existingRequest) {
      await models.FriendRequest.deleteOne({
        userId,
        targetId: userIdToFriend,
      }).exec();
      res.send("Friend request cancelled.");
      return;
    }

    var existingFriend = await models.Friend.findOne({
      userId,
      friendId: userIdToFriend,
    }).select("_id");

    // Unfriend
    if (existingFriend) {
      await models.Friend.deleteOne({
        userId,
        friendId: userIdToFriend,
      }).exec();
      await models.Friend.deleteOne({
        userId: userIdToFriend,
        friendId: userId,
      }).exec();

      await models.User.updateMany(
        { id: { $in: [userId, userIdToFriend] } },
        { $inc: { numFriends: -1 } }
      ).exec();

      res.send("Unfriended this user.");
      return;
    }

    existingRequest = await models.FriendRequest.findOne({
      userId: userIdToFriend,
      targetId: userId,
    }).select("_id");

    // Accept existing request
    if (existingRequest) {
      var userToFriend = await models.User.findOne({
        id: userIdToFriend,
      }).select("lastActive");

      var friend = new models.Friend({
        userId: userId,
        friendId: userIdToFriend,
        lastActive: Date.now(),
      });
      await friend.save();

      friend = new models.Friend({
        userId: userIdToFriend,
        friendId: userId,
        lastActive: userToFriend.lastActive || Date.now(),
      });
      await friend.save();

      await models.FriendRequest.deleteOne({
        userId: userIdToFriend,
        targetId: userId,
      }).exec();

      await models.User.updateMany(
        { id: { $in: [userId, userIdToFriend] } },
        { $inc: { numFriends: 1 } }
      ).exec();

      await routeUtils.createNotification(
        {
          content: `${userName} accepted your friend request.`,
          icon: "fas fa-users",
          link: `/user/${userId}`,
        },
        [userIdToFriend]
      );

      res.send("Friend request accepted.");
      return;
    }

    // Create new request
    var request = new models.FriendRequest({
      userId: userId,
      targetId: userIdToFriend,
    });
    await request.save();

    await routeUtils.createNotification(
      {
        content: `${userName} sent a friend request.`,
        icon: "fas fa-users",
        link: `/user/${userId}`,
      },
      [userIdToFriend]
    );

    res.send("Friend request sent.");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error sending friend request.");
  }
});

router.post("/friend/reject", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var requestFrom = String(req.body.user);

    await models.FriendRequest.deleteOne({
      userId: requestFrom,
      targetId: userId,
    }).exec();

    res.send("Friend request rejected.");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error rejecting friend request.");
  }
});

router.post("/referred", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var referrer = String(req.body.referrer || "").trim();

    if (!referrer || referrer === userId) {
      res.sendStatus(200);
      return;
    }

    var user = await models.User.findOne({ id: userId }).select("referrer ip");

    if (!user) {
      res.sendStatus(200);
      return;
    }

    if (user.referrer) {
      res.sendStatus(200);
      return;
    }

    var referrerUser = await models.User.findOne({
      id: referrer,
      deleted: false,
    }).select("ip");

    if (!referrerUser) {
      res.sendStatus(200);
      return;
    }

    for (let ip of user.ip || []) {
      if ((referrerUser.ip || []).indexOf(ip) != -1) {
        res.sendStatus(200);
        return;
      }
    }

    await models.User.updateOne({ id: userId }, { $set: { referrer } }).exec();
    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.sendStatus(200);
  }
});

router.post("/logout", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    await models.Session.deleteMany({ "session.user.id": userId }).exec();
    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error logging out.");
  }
});

router.post("/delete", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var dbId = req.session.user._id;
    var ip = routeUtils.getIP(req);

    if (!(await routeUtils.rateLimit(ip, "deleteAccount", res))) return;

    // await models.Session.deleteMany({ "session.user.id": userId }).exec();
    req.session.destroy();

    await models.ChannelOpen.deleteMany({ user: userId }).exec();
    await models.Notification.deleteMany({ user: userId }).exec();
    await models.Love.deleteMany({
      $or: [{ userId: userId }, { loveId: userId }],
    }).exec();
    await models.LoveRequest.deleteMany({
      $or: [{ userId: userId }, { loveId: userId }],
    }).exec();
    await models.DocSave.deleteMany({
      $or: [{ userIrd: userId }, { loveId: userId }],
    }).exec();
    await models.Friend.deleteMany({
      $or: [{ userId: userId }, { friendId: userId }],
    }).exec();
    await models.FriendRequest.deleteMany({
      $or: [{ userId: userId }, { friendId: userId }],
    }).exec();
    await models.InGroup.deleteMany({ user: dbId }).exec();

    // Clear vanity URL so it can be claimed by other users
    await models.VanityUrl.deleteMany({ userId: userId }).exec();
    await models.User.updateOne(
      { id: userId },
      { $unset: { "settings.vanityUrl": "" } }
    ).exec();

    await models.User.updateOne(
      { id: userId },
      {
        $set: {
          lastActive: 0,
          deleted: true,
          numFriends: 0,
        },
      }
    ).exec();

    await redis.setUserOffline(userId);
    await redis.deleteUserInfo(userId);

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error deleting account.");
  }
});

router.post("/appeals", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    if (!userId) {
      res.status(401).send("You must be logged in to submit an appeal.");
      return;
    }

    const { reportId, description } = req.body;

    if (!reportId || !description) {
      res.status(400).send("Report ID and description are required.");
      return;
    }

    // Validate report exists and belongs to user
    const report = await models.Report.findOne({
      id: reportId,
      reportedUserId: userId,
      status: "complete",
    }).lean();

    if (!report) {
      res
        .status(404)
        .send("Report not found or you don't have permission to appeal it.");
      return;
    }

    // Check if report has a violation (can't appeal dismissed reports)
    if (!report.finalRuling || !report.linkedViolationTicketId) {
      res.status(400).send("You can only appeal reports with violations.");
      return;
    }

    // Check if there's already a pending appeal for this report
    const existingAppeal = await models.Appeal.findOne({
      reportId: reportId,
      userId: userId,
      status: "pending",
    });

    if (existingAppeal) {
      res
        .status(400)
        .send("You already have a pending appeal for this violation.");
      return;
    }

    // Check if there's already an approved appeal (violation already removed)
    const approvedAppeal = await models.Appeal.findOne({
      reportId: reportId,
      userId: userId,
      status: "approved",
    });

    if (approvedAppeal) {
      res
        .status(400)
        .send("This violation has already been successfully appealed.");
      return;
    }

    // Rate limiting
    if (!(await routeUtils.rateLimit(userId, "fileAppeal", res))) return;

    // Create appeal
    const appeal = new models.Appeal({
      id: shortid.generate(),
      userId: userId,
      reportId: reportId,
      violationTicketId: report.linkedViolationTicketId,
      description: String(description).trim().slice(0, 5000),
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await appeal.save();

    // Create a report entry for the appeal (as if user is reporting themselves)
    const appealReport = new models.Report({
      id: shortid.generate(),
      reporterId: userId,
      reportedUserId: userId,
      rule: report.rule,
      description: `APPEAL: ${description}`,
      status: "open",
      assignees: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: [
        {
          status: "open",
          changedBy: userId,
          timestamp: Date.now(),
          action: "created",
          note: `Appeal for report ${reportId}`,
        },
      ],
      linkedAppealId: appeal.id,
    });

    await appealReport.save();

    logger.info(
      `Appeal ${appeal.id} created by user ${userId} for report ${reportId}`
    );

    // Send Discord notification (same as reports)
    try {
      const user = await models.User.findOne({
        id: userId,
        deleted: false,
      }).select("_id name");

      // Get report counts
      const openReportCount = await models.Report.countDocuments({
        status: "open",
      });
      const inProgressReportCount = await models.Report.countDocuments({
        status: "in-progress",
      });

      const title = `${user.name} appealing violation: https://PassionMafia.io/policy/reports/${appealReport.id}`;
      let reportDetails = `\nNumber of open reports: ${openReportCount}\n`;
      reportDetails += `Number of in-progress reports: ${inProgressReportCount}`;

      const ping = "<@&1107343293848768622>\n";

      // Decode the Base64 webhook URL components
      const wht =
        "QTQ0dG9WSFA3UUNfSk1KbTZZTFh1Q05JT2xhLVoxanZqczhTRDE3WmQyOGktTU5kYmJlbzFCTVRPQzBnTmJKblMwRGM=";
      const whId = "MTMyODgwNjY5OTcxNjMxNzE5NQ==";
      const base = "aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3Mv";

      const decodeBase64 = (str) =>
        Buffer.from(str, "base64").toString("utf-8");
      const webhookURL =
        decodeBase64(base) + decodeBase64(whId) + "/" + decodeBase64(wht);

      await axios.post(webhookURL, {
        content: `${ping}${title}${reportDetails}`,
        username: "SnitchBot",
      });
    } catch (discordError) {
      // Log but don't fail if Discord webhook fails
      logger.warn("Failed to send Discord notification:", discordError);
    }

    res.status(200).send({ appeal, appealReport });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error submitting appeal.");
  }
});

router.post("/poke", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    if (!(await routeUtils.rateLimit(userId, "poke", res))) return;

    var targetId = String(req.body.targetId);

    if (userId === targetId) {
      res.status(400);
      res.send("You cannot poke yourself.");
      return;
    }

    // Confirm mutual friendship
    var friendship = await models.Friend.findOne({
      userId: userId,
      friendId: targetId,
    }).select("_id");

    if (!friendship) {
      res.status(400);
      res.send("You can only poke friends.");
      return;
    }

    // Check both users' disablePokes settings
    var [selfUser, targetUser] = await Promise.all([
      models.User.findOne({ id: userId, deleted: false }).select("settings -_id"),
      models.User.findOne({ id: targetId, deleted: false }).select("settings -_id"),
    ]);

    if (!targetUser) {
      res.status(400);
      res.send("User not found.");
      return;
    }

    if (selfUser?.settings?.disablePokes) {
      res.status(400);
      res.send("You have disabled pokes.");
      return;
    }

    if (targetUser.settings?.disablePokes) {
      res.status(400);
      res.send("This user has disabled pokes.");
      return;
    }

    // Look up existing poke
    var pair = pokePairIds(userId, targetId);
    var existingPoke = await models.Poke.findOne(pair);

    if (existingPoke) {
      if (existingPoke.status === "pending" && !isPokeExpired(existingPoke)) {
        res.status(400);
        res.send("You already have an active poke with this person.");
        return;
      }

      if (
        existingPoke.status === "dismissed" &&
        isDismissCooldownActive(existingPoke) &&
        existingPoke.from === userId
      ) {
        res.status(400);
        res.send("You cannot poke this person yet.");
        return;
      }
    }

    // Upsert poke
    await models.Poke.updateOne(pair, {
      $set: {
        ...pair,
        from: userId,
        to: targetId,
        status: "pending",
        count: 1,
        updatedAt: Date.now(),
        dismissedAt: null,
      },
    }, { upsert: true });

    var userName = await redis.getUserName(userId);
    await routeUtils.createNotification(
      {
        content: `${userName} poked you!`,
        icon: "fas fa-hand-pointer",
        link: `/user/${userId}`,
      },
      [targetId]
    );

    res.send("Poke sent!");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error sending poke.");
  }
});

router.post("/poke/back", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    if (!(await routeUtils.rateLimit(userId, "poke", res))) return;

    var targetId = String(req.body.targetId);

    var pair = pokePairIds(userId, targetId);
    var poke = await models.Poke.findOne(pair);

    if (!poke || poke.status !== "pending" || poke.to !== userId || isPokeExpired(poke)) {
      res.status(400);
      res.send("No active poke to respond to.");
      return;
    }

    // Check if either user has disabled pokes
    var [selfUser, targetUser] = await Promise.all([
      models.User.findOne({ id: userId, deleted: false }).select("settings -_id"),
      models.User.findOne({ id: targetId, deleted: false }).select("settings -_id"),
    ]);

    if (selfUser?.settings?.disablePokes || targetUser?.settings?.disablePokes) {
      res.status(400);
      res.send("Pokes are disabled.");
      return;
    }

    var maxPokes = 1000000;
    var newCount = Math.min(poke.count + 1, maxPokes);

    await models.Poke.updateOne(pair, {
      $set: {
        from: userId,
        to: targetId,
        count: newCount,
        updatedAt: Date.now(),
      },
    });

    var userName = await redis.getUserName(userId);
    await routeUtils.createNotification(
      {
        content: `${userName} poked you back!`,
        icon: "fas fa-hand-pointer",
        link: `/user/${userId}`,
      },
      [targetId]
    );

    res.send("Poked back!");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error poking back.");
  }
});

router.post("/poke/dismiss", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    if (!(await routeUtils.rateLimit(userId, "poke", res))) return;

    var targetId = String(req.body.targetId);

    var pair = pokePairIds(userId, targetId);
    var poke = await models.Poke.findOne(pair);

    if (!poke || poke.status !== "pending" || poke.to !== userId || isPokeExpired(poke)) {
      res.status(400);
      res.send("No active poke to dismiss.");
      return;
    }

    await models.Poke.updateOne(pair, {
      $set: {
        status: "dismissed",
        dismissedAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    res.send("Poke dismissed.");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error dismissing poke.");
  }
});

module.exports = router;
