const express = require("express");
const fs = require("fs");
const path = require("path");
const routeUtils = require("./utils");
const redis = require("../modules/redis");
const models = require("../db/models");
const constants = require("../data/constants");
const customEmoteUtils = require("../lib/Utils");
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

function getEmoteAssetPath(assetId) {
  return path.join(
    process.env.UPLOAD_PATH || "uploads",
    "store",
    "emotes",
    `${assetId}.webp`
  );
}

function getEmoteGroupIconPath(groupKey) {
  return path.join(
    process.env.UPLOAD_PATH || "uploads",
    "store",
    "emote-groups",
    `${groupKey}.webp`
  );
}

function getEmoteGroupAssetIds(groupKey) {
  const emoteDir = path.join(process.env.UPLOAD_PATH || "uploads", "store", "emotes");
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
    imageUrl: buildEmoteImageUrl(assetId),
  }));
}

async function validateEmoteGroupPurchase(userId, item) {
  const user = await models.User.findOne({ id: userId, deleted: false })
    .select("_id customEmotes")
    .lean();
  if (!user) throw new Error("User not found.");

  if (!fs.existsSync(getEmoteGroupIconPath(item.key))) {
    throw new Error("Emote group icon is unavailable.");
  }

  const assets = buildEmoteGroupAssets(item.key);
  if (!assets.length) {
    throw new Error("Emote group has no emotes.");
  }

  for (const asset of assets) {
    if (!asset.name || asset.name.includes(":") || asset.name.includes(" ")) {
      throw new Error("Emote group contains an invalid emote name.");
    }

    const existingSameName = await models.CustomEmote.findOne({
      creator: user._id,
      name: asset.name,
      deleted: false,
    })
      .select("id")
      .lean();
    if (existingSameName && existingSameName.id !== asset.id) {
      throw new Error(`You already have an emote named :${asset.name}:.`);
    }
  }

  return { userMongoId: user._id, emoteAssets: assets };
}

async function grantPurchasedEmoteGroup(userId, item, context = {}) {
  const userMongoId = context.userMongoId;
  const extension = "webp";
  const assets = context.emoteAssets || buildEmoteGroupAssets(item.key);
  const customEmotesByToken = {};
  const customEmoteIds = [];

  for (const asset of assets) {
    const targetPath = customEmoteUtils.getCustomEmoteFilepath(
      userId,
      asset.id,
      extension
    );

    const customEmote = await models.CustomEmote.findOneAndUpdate(
      { creator: userMongoId, id: asset.id },
      {
        $set: {
          id: asset.id,
          name: asset.name,
          extension,
          creator: userMongoId,
          deleted: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).exec();

    customEmoteIds.push(customEmote._id);
    customEmotesByToken[`:${asset.name}:`] = {
      userId,
      id: asset.id,
      extension,
      name: asset.name,
      path: targetPath,
    };
  }

  await models.User.updateOne(
    userMongoId ? { _id: userMongoId } : { id: userId },
    { $addToSet: { customEmotes: { $each: customEmoteIds } } }
  ).exec();

  context.customEmote = customEmotesByToken;
}

function buildRuntimeShopItem(item) {
  return {
    name: item.name || "",
    desc: item.desc || "",
    key: item.key || "",
    hidden: item.hidden,
    price: Number(item.price || 0),
    currency: item.currency,
    limit: item.limit || null,
    disabled: false,
    propagateItemUpdates: {},
    validate: isEmoteGroupItem(item)
      ? (userId) => validateEmoteGroupPurchase(userId, item)
      : undefined,
    onBuy: isEmoteGroupItem(item)
      ? (userId, context) => grantPurchasedEmoteGroup(userId, item, context)
      : async function (userId) {},
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

async function resolveAvatarPurchaseItem(key) {
  if (!isAvatarItem({ key })) return null;
  

  const dbItem = await models.AvatarItem.findOne({
    key,
    $or: [{ hidden: false }, { hidden: { $exists: false } }],
  }).lean();

  return dbItem
    ? { item: buildRuntimeShopItem(dbItem), purchaseKind: "avatar" }
    : null;
}

async function resolveEmoteGroupPurchaseItem(key) {
  if (!isEmoteGroupItem({ key })) return null;
  

  const dbItem = await models.EmoteGroup.findOne({
    key,
    $or: [{ hidden: false }, { hidden: { $exists: false } }],
  }).lean();

  return dbItem
    ? { item: buildRuntimeShopItem(dbItem), purchaseKind: "emoteGroup" }
    : null;
}

async function resolveShopPurchaseItem(key, itemIndex) {
  if (key) {
    if (
      HIDDEN_SHOP_ITEM_KEYS.includes(key) ||
      isAvatarItem({ key }) ||
      isEmoteCatalogItem({ key })
    ) {
      return null;
    }

    const dbItem = await models.ShopItem.findOne({
      key,
      $or: [{ hidden: false }, { hidden: { $exists: false } }],
    }).lean();

    return dbItem
      ? { item: buildRuntimeShopItem(dbItem), purchaseKind: "shopItem" }
      : null;
  }

  const shopItems = await getShopItems();
  if (itemIndex < 0 || itemIndex >= shopItems.length) return null;
  const runtimeItem = shopItems[itemIndex];
  if (
    !runtimeItem?.key ||
    HIDDEN_SHOP_ITEM_KEYS.includes(runtimeItem.key) ||
    isAvatarItem(runtimeItem) ||
    isEmoteCatalogItem(runtimeItem)
  ) {
    return null;
  }

  const dbItem = await models.ShopItem.findOne({
    key: runtimeItem.key,
    $or: [{ hidden: false }, { hidden: { $exists: false } }],
  }).lean();

  return dbItem
    ? { item: buildRuntimeShopItem(dbItem), purchaseKind: "shopItem" }
    : null;
}

async function resolvePurchaseRequest(key, itemIndex) {
  if (isAvatarItem({ key })) {
    return resolveAvatarPurchaseItem(key);
  }
  if (isEmoteGroupItem({ key })) {
    return resolveEmoteGroupPurchaseItem(key);
  }
  return resolveShopPurchaseItem(key, itemIndex);
}

function invalidateShopItemsCache() {
  shopItemsCache = null;
  shopItemsCacheTime = 0;
}

function buildEmoteImageUrl(emoteKey) {
  return `/uploads/store/emotes/${emoteKey}.webp`;
}

function buildEmoteGroupIconUrl(groupKey) {
  return `/uploads/store/emote-groups/${groupKey}.webp`;
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

function isDollarBalanceItem(item = {}) {
  return item.currency === "dollar";
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

async function getItemDollarPrice(item) {
  return roundDollarAmount(Number(item.price || 0));
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

    const [avatarItems] =
      await Promise.all([getAvatarItems()]);

    res.send({
      avatarItems: avatarItems
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

    const [emoteItems] =
      await Promise.all([getEmoteItems()]);

    res.send({
      emoteItems: emoteItems
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.post(
  "/purchase",
  async function (req, res) {
    try {
      var userId = await routeUtils.verifyLoggedIn(req);
      var itemIndex = Number(req.body.item);
      const requestedKey = String(req.body.key || "").trim();
      
      const resolvedPurchase = await resolvePurchaseRequest(
        requestedKey,
        itemIndex
      );
      var item = resolvedPurchase?.item;
      const purchaseKind = resolvedPurchase?.purchaseKind;

      if (!item) {
        res.status(500);
        res.send("Invalid item purchased.");
        return;
      }
      const purchase = getPurchaseDetails(item);

      if (!Number.isFinite(purchase.price) || purchase.price < 0) {
        res.status(500);
        res.send("Invalid item price.");
        return;
      }

      var user = await models.User.findOne({ id: userId }).select(
        "coins balanceDollar itemsOwned"
      );
      const currentBalance = Number(user?.[purchase.balanceField] || 0);

      if (currentBalance < purchase.price) {
        res.status(500);
        res.send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
        return;
      }

      if (item.limit != null && Number(user.itemsOwned?.[item.key] || 0) >= item.limit) {
        res.status(500);
        res.send("You already own this.");
        return;
      }

      var context;
      if (item.validate) {
        try {
          context = await item.validate(userId, req.body);
        } catch (e) {
          res.status(400);
          res.send(e.message);
          return;
        }
      }

      let userChanges = {
        [`itemsOwned.${item.key}`]: 1,
      };
      userChanges[purchase.balanceField] = -1 * purchase.price;

      for (let k in item.propagateItemUpdates) {
        let change = item.propagateItemUpdates[k];
        userChanges[`itemsOwned.${k}`] = change;
      }

      const updateResult = await models.User.updateOne(
        { id: userId, [purchase.balanceField]: { $gte: purchase.price } },
        {
          $inc: userChanges,
        }
      ).exec();

      if (!updateResult.modifiedCount) {
        res.status(500);
        res.send(`You do not have enough ${purchase.balanceLabel} to purchase this.`);
        return;
      }

      await item.onBuy(userId, context);
      if (context) {
        delete context.userMongoId;
        delete context.emoteAssets;
      }

      await redis.cacheUserInfo(userId, true);
      const updatedUser = await models.User.findOne({ id: userId })
        .select("coins balanceDollar")
        .lean();

      res.send({
        ...(context || {}),
        purchaseKind,
        currency: purchase.currency,
        price: purchase.price,
        balanceType: purchase.balanceField,
        balance: Number(updatedUser?.coins || 0),
        balanceDollar: Number(updatedUser?.balanceDollar || 0),
      });
    } catch (e) {
      logger.error(e);
      res.status(500);
      res.send("Error completing purchase.");
    }
  }
);

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
