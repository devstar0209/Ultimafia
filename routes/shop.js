const express = require("express");
const fs = require("fs");
const routeUtils = require("./utils");
const redis = require("../modules/redis");
const models = require("../db/models");
const utils = require("../lib/Utils");
const logger = require("../modules/logging")(".");
const shortid = require("shortid");
const router = express.Router();

const HIDDEN_SHOP_ITEM_KEYS = [
  "bonusRedHearts",
  "customEmotes",
  "customEmotesExtra",
];

async function checkStampEligibility(userId, gameId) {
  const game = await models.Game.findOne({ id: gameId }).select(
    "type endTime broken winners playerIdMap playerRoleMap history"
  );

  if (!game) throw new Error("Game not found.");
  if (!game.endTime) throw new Error("This game has not finished yet.");
  if (game.type !== "Mafia")
    throw new Error("Stamps are only available for Mafia games.");
  if (game.broken)
    throw new Error("Cannot purchase a stamp from a broken game.");

  const playerIdMap = JSON.parse(game.playerIdMap || "{}");
  const playerId = playerIdMap[userId];
  if (!playerId) throw new Error("You were not a player in this game.");

  if (!game.winners.includes(playerId))
    throw new Error("You did not win this game.");

  let role;
  const playerRoleMap = JSON.parse(game.playerRoleMap || "{}");
  if (playerRoleMap[userId]) {
    role = playerRoleMap[userId];
  } else {
    try {
      const history = JSON.parse(game.history || "{}");
      const stateKeys = Object.keys(history)
        .filter((k) => !isNaN(k))
        .sort((a, b) => Number(b) - Number(a));
      for (const key of stateKeys) {
        const stateRoles = history[key]?.roles;
        if (stateRoles && stateRoles[playerId]) {
          role = stateRoles[playerId].split(":")[0];
          break;
        }
      }
    } catch (e) {
      // history parsing failed
    }
  }

  if (!role)
    throw new Error("Could not determine your role in this game.");

  return { gameType: game.type, role };
}

// Cache for shop items fetched from database
let shopItemsCache = null;
let shopItemsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getEmoteNameFromAssetId(assetId, groupKey = "") {
  const prefix = `${groupKey}-`;
  return String(assetId || "")
    .replace(prefix, "")
    .trim()
    .toLowerCase();
}

function getEmoteGroupAssetIds(groupKey) {
  const emoteDir = utils.resolveUploadPath(`${utils.EMOTES_UPLOAD_PATH}/${groupKey}`);
  if (!fs.existsSync(emoteDir)) return [];

  return fs
    .readdirSync(emoteDir)
    .filter((filename) => filename.startsWith(`${groupKey}-`) && filename.endsWith(".webp"))
    .map((filename) => filename.replace(/\.webp$/i, ""))
    .sort((a, b) => a.localeCompare(b));
}

function buildEmoteGroupAssets(groupKey) {
  return getEmoteGroupAssetIds(groupKey).map((assetId) => ({
    id: assetId,
    name: getEmoteNameFromAssetId(assetId, groupKey),
    imageUrl: utils.toPublicUrl(`${utils.EMOTES_UPLOAD_PATH}/${groupKey}`, assetId),
  }));
}

function buildRuntimeShopItem(item) {
  return {
    name: item.name || "",
    desc: item.desc || "",
    key: item.key || "",
    imageUrl: item.imageUrl || "",
    hidden: item.hidden,
    price: Number(item.price || 0),
    currency: item.currency,
    limit: item.limit || null,
    holderCnt: item.holderCnt,
    disabled: false,
    propagateItemUpdates: {},
  };
}

async function getShopItems() {
  const now = Date.now();
  
  // Return cached items if still valid
  if (shopItemsCache && now - shopItemsCacheTime < CACHE_TTL) {
    return shopItemsCache;
  }

  try {
    // Fetch from database, excluding hidden items
    // Use $or to include items that are either explicitly not hidden or don't have the field
    const dbItems = await models.ShopItem.find({
      key: { $nin: HIDDEN_SHOP_ITEM_KEYS },
      $or: [{ hidden: false }, { hidden: { $exists: false } }],
    })
      .sort("sortOrder")
      .lean();

    // Map database items to shop items format
    const visibleItems = dbItems.filter(
      (item) => !isAvatarItem(item) && !isEmoteCatalogItem(item)
    );

    const shopItems = visibleItems.map(buildRuntimeShopItem);

    shopItemsCache = shopItems;
    shopItemsCacheTime = now;
    return shopItemsCache;
  } catch (e) {
    logger.error("Error fetching shop items from database:", e);
    // Fallback to empty array if database fails
    return [];
  }
}

async function getAvatarItems() {
  const avatarItems = await models.AvatarItem.find({
    $or: [{ hidden: false }, { hidden: { $exists: false } }],
  })
    .sort("sortOrder")
    .lean();
  return avatarItems.map(buildRuntimeShopItem);
}

async function getEmoteGroupItems() {
  const emoteGroups = await models.EmoteGroup.find({
    $or: [{ hidden: false }, { hidden: { $exists: false } }],
  })
    .sort("sortOrder")
    .lean();
  return emoteGroups.map(buildRuntimeShopItem);
}

function invalidateShopItemsCache() {
  shopItemsCache = null;
  shopItemsCacheTime = 0;
}

function isAvatarItem(item = {}) {
  return String(item.key || "").startsWith("avatar-");
}

function isEmoteGroupItem(item = {}) {
  return String(item.key || "").startsWith("emote-group-");
}

function isEmoteCatalogItem(item = {}) {
  return String(item.key || "").startsWith("emote-");
}

function getPurchaseDetails(item = {}) {
  const currency = item.currency;
  const price =
    currency === "dollar"
      ? roundDollarAmount(Number(item.price || 0))
      : Number(item.price || 0);

  return {
    currency,
    price,
    balanceField: currency === "dollar" ? "balanceDollar" : "coins",
    balanceLabel: currency === "dollar" ? "dollar balance" : "coins",
  };
}

function roundDollarAmount(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

router.get("/info", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
 
    const shopItems = await getShopItems();

    res.send({
      shopItems
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.get("/avatars", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await routeUtils.verifyLoggedIn(req, true);

    const [avatarItems, user] = await Promise.all([
      getAvatarItems(),
      userId
        ? models.User.findOne({ id: userId, deleted: false })
            .select("avatarsOwned itemsOwned settings coins balanceDollar -_id")
            .lean()
        : null,
    ]);
    const ownedAvatarKeys = new Set(user?.avatarsOwned || []);
    const itemsOwned = user?.itemsOwned || {};
    const equippedAvatarKey = user?.settings?.equippedAvatarKey || "";

    res.send({
      avatarItems: avatarItems.map((avatar) => {
        const owned =
          ownedAvatarKeys.has(avatar.key) ||
          Number(itemsOwned?.[avatar.key] || 0) > 0;
        return {
          ...avatar,
          owned,
          equipped: equippedAvatarKey === avatar.key,
          available: Boolean(avatar.imageUrl),
        };
      }),
      equippedAvatarKey,
      balance: Number(user?.coins || 0),
      balanceDollar: Number(user?.balanceDollar || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.get("/emotes", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    const userId = await routeUtils.verifyLoggedIn(req, true);

    const [emoteItems, user] = await Promise.all([
      getEmoteGroupItems(),
      userId
        ? models.User.findOne({ id: userId, deleted: false })
            .select("emoteGroupsOwned coins balanceDollar -_id")
            .lean()
        : null,
    ]);
    const emoteGroupsOwned = new Set(user?.emoteGroupsOwned || []);

    res.send({
      emoteItems: emoteItems.map((group) => {
        const emotes = buildEmoteGroupAssets(group.key);

        return {
          ...group,
          iconUrl: group.imageUrl || "",
          emotes,
          owned: emoteGroupsOwned.has(group.key),
          available: Boolean(group.imageUrl && emotes.length),
        };
      }),
      balance: Number(user?.coins || 0),
      balanceDollar: Number(user?.balanceDollar || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.post("/purchaseShopItem", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const itemIndex = Number(req.body.item);
    const requestedKey = String(req.body.key || "").trim();
    let dbItem;

    if (requestedKey) {
      if (
        HIDDEN_SHOP_ITEM_KEYS.includes(requestedKey) ||
        isAvatarItem({ key: requestedKey }) ||
        isEmoteCatalogItem({ key: requestedKey })
      ) {
        res.status(500).send("Invalid item purchased.");
        return;
      }

      dbItem = await models.ShopItem.findOne({
        key: requestedKey,
        $or: [{ hidden: false }, { hidden: { $exists: false } }],
      }).lean();
    } else {
      const shopItems = await getShopItems();
      if (itemIndex < 0 || itemIndex >= shopItems.length) {
        res.status(500).send("Invalid item purchased.");
        return;
      }

      const runtimeItem = shopItems[itemIndex];
      if (
        !runtimeItem?.key ||
        HIDDEN_SHOP_ITEM_KEYS.includes(runtimeItem.key) ||
        isAvatarItem(runtimeItem) ||
        isEmoteCatalogItem(runtimeItem)
      ) {
        res.status(500).send("Invalid item purchased.");
        return;
      }

      dbItem = await models.ShopItem.findOne({
        key: runtimeItem.key,
        $or: [{ hidden: false }, { hidden: { $exists: false } }],
      }).lean();
    }

    if (!dbItem) {
      res.status(500).send("Invalid item purchased.");
      return;
    }

    const item = dbItem;
    const purchase = getPurchaseDetails(item);

    if (!Number.isFinite(purchase.price) || purchase.price < 0) {
      res.status(500).send("Invalid item price.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("_id coins balanceDollar itemsOwned")
      .lean();
    if (!user) {
      res.status(404).send("User not found.");
      return;
    }

    if (Number(user[purchase.balanceField] || 0) < purchase.price) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    if (item.limit != null && Number(user.itemsOwned?.[item.key] || 0) >= item.limit) {
      res.status(500).send("You already own this.");
      return;
    }

    let context = {};
    if (item.key === "stamp") {
      let gameId = String(req.body.gameId || "").trim();
      const urlMatch = gameId.match(/\/game\/([^/?\s]+)/);
      if (urlMatch) gameId = urlMatch[1];
      if (!gameId) {
        res.status(400).send("Please provide a game URL or ID.");
        return;
      }

      try {
        context = await checkStampEligibility(userId, gameId);
      } catch (e) {
        res.status(400).send(e.message);
        return;
      }

      const existingStamp = await models.Stamp.findOne({ userId, gameId })
        .select("_id")
        .lean();
      if (existingStamp) {
        res.status(400).send("You already have a stamp for this game.");
        return;
      }
      context.gameId = gameId;
    }

    const userChanges = {
      [`itemsOwned.${item.key}`]: 1,
      [purchase.balanceField]: -1 * purchase.price,
    };

    const userFilter = {
      id: userId,
      [purchase.balanceField]: { $gte: purchase.price },
    };
    if (item.limit != null) {
      userFilter.$or = [
        { [`itemsOwned.${item.key}`]: { $exists: false } },
        { [`itemsOwned.${item.key}`]: { $lt: item.limit } },
      ];
    }

    const updateResult = await models.User.updateOne(
      userFilter,
      { $inc: userChanges }
    ).exec();

    if (!updateResult.modifiedCount) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    if (item.key === "stamp") {
      try {
        await models.Stamp.create({
          user: user._id,
          userId,
          gameId: context.gameId,
          gameType: context.gameType,
          role: context.role,
          hidden: false,
          createdAt: Date.now(),
        });
      } catch (e) {
        await models.User.updateOne(
          { id: userId },
          {
            $inc: {
              [`itemsOwned.${item.key}`]: -1,
              [purchase.balanceField]: purchase.price,
            },
          }
        ).exec();
        throw e;
      }
    }

    await redis.cacheUserInfo(userId, true);
    const updatedUser = await models.User.findOne({ id: userId })
      .select("coins balanceDollar")
      .lean();

    res.send({
      ...context,
      purchaseKind: "shopItem",
      currency: purchase.currency,
      price: purchase.price,
      balanceType: purchase.balanceField,
      balance: Number(updatedUser?.coins || 0),
      balanceDollar: Number(updatedUser?.balanceDollar || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error completing purchase.");
  }
});

router.post("/purchaseAvatar", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const key = String(req.body.key || "").trim();

    if (!isAvatarItem({ key })) {
      res.status(500).send("Invalid item purchased.");
      return;
    }

    const item = await models.AvatarItem.findOne({
      key,
      $or: [{ hidden: false }, { hidden: { $exists: false } }],
    }).lean();

    if (!item) {
      res.status(500).send("Invalid item purchased.");
      return;
    }
    if (!item.imageUrl) {
      res.status(400).send("Avatar image is unavailable.");
      return;
    }

    const purchase = getPurchaseDetails(item);
    if (!Number.isFinite(purchase.price) || purchase.price < 0) {
      res.status(500).send("Invalid item price.");
      return;
    }

    if (item.limit != null && Number(item.holderCnt || 0) >= Number(item.limit)) {
      res.status(402).send("This avatar is sold out.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("coins balanceDollar avatarsOwned")
      .lean();
    if (!user) {
      res.status(404).send("User not found.");
      return;
    }

    if ((user.avatarsOwned || []).includes(item.key)) {
      res.status(500).send("You already own this.");
      return;
    }

    if (Number(user[purchase.balanceField] || 0) < purchase.price) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    const userUpdateResult = await models.User.updateOne(
      {
        id: userId,
        [purchase.balanceField]: { $gte: purchase.price },
        avatarsOwned: { $ne: item.key },
      },
      {
        $inc: {
          [purchase.balanceField]: -1 * purchase.price,
        },
        $addToSet: {
          avatarsOwned: item.key,
        },
      }
    ).exec();

    if (!userUpdateResult.modifiedCount) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    const avatarFilter = { key: item.key };
    if (item.limit != null) {
      avatarFilter.holderCnt = { $lt: Number(item.limit) };
    }
    const avatarUpdateResult = await models.AvatarItem.updateOne(
      avatarFilter,
      { $inc: { holderCnt: 1 } }
    ).exec();

    if (!avatarUpdateResult.modifiedCount) {
      await models.User.updateOne(
        { id: userId },
        {
          $inc: { [purchase.balanceField]: purchase.price },
          $pull: { avatarsOwned: item.key },
        }
      ).exec();
      res.status(402).send("This avatar is sold out.");
      return;
    }

    await redis.cacheUserInfo(userId, true);
    const updatedUser = await models.User.findOne({ id: userId })
      .select("coins balanceDollar")
      .lean();
    const updatedAvatar = await models.AvatarItem.findOne({ key: item.key })
      .select("holderCnt -_id")
      .lean();

    res.send({
      purchaseKind: "avatar",
      currency: purchase.currency,
      price: purchase.price,
      balanceType: purchase.balanceField,
      balance: Number(updatedUser?.coins || 0),
      balanceDollar: Number(updatedUser?.balanceDollar || 0),
      holderCnt: Number(updatedAvatar?.holderCnt || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error completing purchase.");
  }
});

router.post("/purchaseEmoteGroup", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const key = String(req.body.key || "").trim();

    if (!isEmoteGroupItem({ key })) {
      res.status(500).send("Invalid item purchased.");
      return;
    }

    const item = await models.EmoteGroup.findOne({
      key,
      $or: [{ hidden: false }, { hidden: { $exists: false } }],
    }).lean();

    if (!item) {
      res.status(500).send("Invalid item purchased.");
      return;
    }
    if (!item.imageUrl) {
      res.status(400).send("Emote group icon is unavailable.");
      return;
    }

    const assets = buildEmoteGroupAssets(item.key);
    if (!assets.length) {
      res.status(400).send("Emote group has no emotes.");
      return;
    }
    for (const asset of assets) {
      if (!asset.name || asset.name.includes(":") || asset.name.includes(" ")) {
        res.status(400).send("Emote group contains an invalid emote name.");
        return;
      }
    }

    const purchase = getPurchaseDetails(item);
    if (!Number.isFinite(purchase.price) || purchase.price < 0) {
      res.status(500).send("Invalid item price.");
      return;
    }

    const user = await models.User.findOne({ id: userId, deleted: false })
      .select("coins balanceDollar emoteGroupsOwned")
      .lean();
    if (!user) {
      res.status(404).send("User not found.");
      return;
    }

    if ((user.emoteGroupsOwned || []).includes(item.key)) {
      res.status(500).send("You already own this.");
      return;
    }

    if (Number(user[purchase.balanceField] || 0) < purchase.price) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    const updateResult = await models.User.updateOne(
      {
        id: userId,
        [purchase.balanceField]: { $gte: purchase.price },
        emoteGroupsOwned: { $ne: item.key },
      },
      {
        $inc: {
          [purchase.balanceField]: -1 * purchase.price,
        },
        $addToSet: {
          emoteGroupsOwned: item.key,
        },
      }
    ).exec();

    if (!updateResult.modifiedCount) {
      res.status(500).send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
      return;
    }

    await redis.cacheUserInfo(userId, true);
    const updatedUser = await models.User.findOne({ id: userId })
      .select("coins balanceDollar")
      .lean();

    res.send({
      purchaseKind: "emoteGroup",
      currency: purchase.currency,
      price: purchase.price,
      balanceType: purchase.balanceField,
      balance: Number(updatedUser?.coins || 0),
      balanceDollar: Number(updatedUser?.balanceDollar || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error completing purchase.");
  }
});

router.post("/transferCoins", async function (req, res) {
  try {
    const senderId = await routeUtils.verifyLoggedIn(req);
    const { recipientUsername, amount } = req.body;

    const transferAmount = Number(amount);
    if (
      !recipientUsername ||
      !Number.isFinite(transferAmount) ||
      transferAmount <= 0
    ) {
      return res.status(400).send("Invalid transfer data.");
    }

    const [recipient, sender] = await Promise.all([
      models.User.findOne({
        name: recipientUsername,
        deleted: false,
      })
        .select("id")
        .lean()
        .exec(),
      models.User.findOne({ id: senderId }).select("name").lean().exec(),
    ]);

    if (!recipient) {
      return res.status(404).send("Recipient not found.");
    }
    if (!sender) {
      return res.status(404).send("Sender not found.");
    }
    if (recipient.id === senderId) {
      return res.status(400).send("Cannot transfer coins to yourself.");
    }

    // Atomically subtract coins only if balance is sufficient
    const debitResult = await models.User.updateOne(
      { id: senderId, coins: { $gte: transferAmount } },
      { $inc: { coins: -transferAmount } }
    ).exec();

    const modified =
      debitResult.modifiedCount ??
      debitResult.nModified ??
      debitResult.matchedCount ??
      0;
    if (!modified) {
      return res.status(400).send("Insufficient balance.");
    }

    const coinText = transferAmount === 1 ? "coin" : "coins";

    try {
      await Promise.all([
        models.User.updateOne(
          { id: recipient.id },
          { $inc: { coins: transferAmount } }
        ).exec(),
        models.Notification.create({
          id: shortid.generate(),
          user: recipient.id,
          isChat: false,
          content: `${sender.name} has sent you ${transferAmount} ${coinText}!`,
          date: Date.now(),
          read: false,
        }),
      ]);

      await Promise.all([
        redis.cacheUserInfo(senderId, true),
        redis.cacheUserInfo(recipient.id, true),
      ]);

      return res.sendStatus(200);
    } catch (e) {
      // If adding to recipient fails, refund the sender
      await models.User.updateOne(
        { id: senderId },
        { $inc: { coins: transferAmount } }
      ).exec();
      throw e;
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).send("Error transferring coins.");
  }
});

router.get("/stampSuggestions", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var userDoc = await models.User.findOne({ id: userId, deleted: false })
      .select("_id")
      .lean();

    if (!userDoc) {
      return res.status(404).send("User not found.");
    }

    // Get last 30 finished Mafia games
    var games = await models.Game.find({
      users: userDoc._id,
      type: "Mafia",
      endTime: { $exists: true },
      broken: { $ne: true },
    })
      .sort("-endTime")
      .limit(30)
      .select("id users players winners playerRoleMap")
      .lean();

    // Filter to games the user won
    var wonGames = [];
    for (var game of games) {
      var userIdx = (game.users || []).findIndex(
        (u) => u && u.toString() === userDoc._id.toString()
      );
      if (userIdx === -1 || !game.players || !game.players[userIdx]) continue;
      var playerId = game.players[userIdx];
      if (!game.winners || !game.winners.includes(playerId)) continue;

      var roleMap = JSON.parse(game.playerRoleMap || "{}");
      var role = roleMap[userId];
      if (!role) continue;

      wonGames.push({ gameId: game.id, role });
    }

    // Remove games where user already has a stamp
    var gameIds = wonGames.map((g) => g.gameId);
    var existingStamps = await models.Stamp.find({
      userId,
      gameId: { $in: gameIds },
    })
      .select("gameId")
      .lean();
    var stampedGameIds = new Set(existingStamps.map((s) => s.gameId));

    var suggestions = wonGames.filter((g) => !stampedGameIds.has(g.gameId));

    res.send(suggestions);
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading stamp suggestions.");
  }
});

router.post("/checkStampEligibility", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);

    let gameId = String(req.body.gameId || "").trim();
    const urlMatch = gameId.match(/\/game\/([^/?\s]+)/);
    if (urlMatch) gameId = urlMatch[1];

    if (!gameId) {
      return res.status(400).send("Please provide a game URL or ID.");
    }

    var result;
    try {
      result = await checkStampEligibility(userId, gameId);
    } catch (e) {
      return res.status(400).send(e.message);
    }
    res.send({ gameId, gameType: result.gameType, role: result.role });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error checking stamp eligibility.");
  }
});

router.post("/stamp/toggle-hide", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    const { stampId } = req.body;

    if (!stampId) {
      return res.status(400).send("Missing stamp ID.");
    }

    var stamp;
    try {
      stamp = await models.Stamp.findById(stampId);
    } catch (e) {
      return res.status(400).send("Invalid stamp ID.");
    }
    if (!stamp || stamp.userId !== userId) {
      return res.status(404).send("Stamp not found.");
    }

    stamp.hidden = !stamp.hidden;
    await stamp.save();

    res.send({ hidden: stamp.hidden });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error toggling stamp visibility.");
  }
});

module.exports = router;

// Export cache invalidation function
router.invalidateShopItemsCache = function() {
  shopItemsCache = null;
  shopItemsCacheTime = 0;
};

module.exports.invalidateShopItemsCache = router.invalidateShopItemsCache;
