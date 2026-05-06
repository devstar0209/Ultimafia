const express = require("express");
const fs = require("fs");
const routeUtils = require("./utils");
const redis = require("../modules/redis");
const models = require("../db/models");
const constants = require("../data/constants");
const defaultSettings = require("../lib/defaultSettings");
const logger = require("../modules/logging")(".");
const shortid = require("shortid");
const router = express.Router();

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

async function getShopItems() {
  const now = Date.now();
  
  // Return cached items if still valid
  if (shopItemsCache && now - shopItemsCacheTime < CACHE_TTL) {
    return shopItemsCache;
  }

  try {
    // Fetch from database, excluding hidden items
    // Use $or to include items that are either explicitly not hidden or don't have the field
    const dbItems = await models.ShopItem.find({ $or: [{ hidden: false }, { hidden: { $exists: false } }] })
      .sort("sortOrder")
      .lean();

    // Map database items to shop items format
    const shopItems = dbItems.map((item) => ({
      name: item.name || "",
      desc: item.desc || "",
      key: item.key || "",
      hidden: item.hidden,
      price: Number(item.price || 0),
      limit: item.limit || null,
      disabled: false,
      propagateItemUpdates: {},
      onBuy: async function (userId) {},
    }));

    shopItemsCache = shopItems;
    shopItemsCacheTime = now;
    return shopItems;
  } catch (e) {
    logger.error("Error fetching shop items from database:", e);
    // Fallback to empty array if database fails
    return [];
  }
}

function invalidateShopItemsCache() {
  shopItemsCache = null;
  shopItemsCacheTime = 0;
}

function buildAvatarImageUrl(avatarKey) {
  return `/uploads/store/avatars/${avatarKey}.webp`;
}

function isDollarBalanceItem(item = {}) {
  return String(item.key || "").startsWith("avatar-");
}

function roundDollarAmount(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

async function getItemDollarPrice(item) {
  const settings = await defaultSettings.getSettings(models);
  const coinsPerDollar = Number(settings.coinsPerDollar || 100);
  const divisor = coinsPerDollar > 0 ? coinsPerDollar : 100;

  return roundDollarAmount(Number(item.price || 0) / divisor);
}

router.get("/info", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId }).select(
      "coins balanceDollar itemsOwned settings"
    );
    
    const shopItems = await getShopItems();
    const shopItemsWithPricing = await Promise.all(
      shopItems.map(async (item) => ({
        ...item,
        priceDollar: isDollarBalanceItem(item)
          ? await getItemDollarPrice(item)
          : null,
      }))
    );
    const avatarItems = shopItemsWithPricing
      .filter((item) => String(item.key || "").startsWith("avatar-"))
      .map((item) => {
        const key = String(item.key || "");
        const absolutePath = `${process.env.UPLOAD_PATH}/store/avatars/${key}.webp`;
        return {
          key,
          name: item.name,
          price: Number(item.price || 0),
          priceDollar: item.priceDollar,
          description: item.desc || "",
          owned: Number(user?.itemsOwned?.[key] || 0) > 0,
          available: fs.existsSync(absolutePath),
          imageUrl: buildAvatarImageUrl(key),
        };
      });

    res.send({
      shopItems: shopItemsWithPricing,
      avatarItems,
      equippedAvatarKey: String(user?.settings?.equippedAvatarKey || ""),
      balance: Number(user?.coins || 0),
      balanceDollar: Number(user?.balanceDollar || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.post(
  "/spendCoins",
  async function (req, res) {
    try {
      var userId = await routeUtils.verifyLoggedIn(req);
      var itemIndex = Number(req.body.item);
      
      const shopItems = await getShopItems();
      
      if (itemIndex < 0 || itemIndex >= shopItems.length) {
        res.status(500);
        res.send("Invalid item purchased.");
        return;
      }
      var item = shopItems[itemIndex];

      var user = await models.User.findOne({ id: userId }).select(
        "coins balanceDollar itemsOwned"
      );
      const usesDollarBalance = isDollarBalanceItem(item);
      const dollarPrice = usesDollarBalance
        ? await getItemDollarPrice(item)
        : 0;

      if (
        usesDollarBalance
          ? Number(user.balanceDollar || 0) < dollarPrice
          : user.coins < item.price
      ) {
        res.status(500);
        res.send(
          usesDollarBalance
            ? "You do not have enough dollar balance to purchase this."
            : "You do not have enough coins to purchase this."
        );
        return;
      }

      if (item.limit != null && user.itemsOwned[item.key] >= item.limit) {
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
      userChanges[usesDollarBalance ? "balanceDollar" : "coins"] =
        -1 * (usesDollarBalance ? dollarPrice : item.price);

      for (let k in item.propagateItemUpdates) {
        let change = item.propagateItemUpdates[k];
        userChanges[`itemsOwned.${k}`] = change;
      }

      await models.User.updateOne(
        { id: userId },
        {
          $inc: userChanges,
        }
      ).exec();

      await item.onBuy(userId, context);

      await redis.cacheUserInfo(userId, true);

      res.send({
        ...(context || {}),
        balanceType: usesDollarBalance ? "balanceDollar" : "coins",
        balance: Number(user.coins || 0) - (usesDollarBalance ? 0 : item.price),
        balanceDollar:
          Number(user.balanceDollar || 0) - (usesDollarBalance ? dollarPrice : 0),
      });
    } catch (e) {
      logger.error(e);
      res.status(500);
      res.send("Error spending coins.");
    }
  },

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
  })
);

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
