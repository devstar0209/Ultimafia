const express = require("express");
const braintree = require("braintree");
const axios = require("axios");
const fs = require("fs");
const routeUtils = require("./utils");
const redis = require("../modules/redis");
const models = require("../db/models");
const constants = require("../data/constants");
const logger = require("../modules/logging")(".");
const shortid = require("shortid");
const router = express.Router();

const NOWPAYMENTS_API_BASE =
  process.env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io/v1";
const NOWPAYMENTS_SUCCESS_STATUSES = new Set([
  "finished",
  "confirmed",
  "sending",
]);
const DEFAULT_NOWPAYMENTS_CURRENCIES = ["btc", "eth", "usdttrc20", "usdc"];
const NOWPAYMENTS_DISPLAY_ORDER = ["USDT", "USDC", "ETH", "BTC"];
const NOWPAYMENTS_DISPLAY_CURRENCIES = new Set(NOWPAYMENTS_DISPLAY_ORDER);

function getBraintreeGateway() {
  const merchantId = process.env.BRAINTREE_MERCHANT_ID;
  const publicKey = process.env.BRAINTREE_PUBLIC_KEY;
  const privateKey = process.env.BRAINTREE_PRIVATE_KEY;
  const envName = (process.env.BRAINTREE_ENV || "Sandbox").toLowerCase();

  if (!merchantId || !publicKey || !privateKey) return null;

  return new braintree.BraintreeGateway({
    environment:
      envName === "production"
        ? braintree.Environment.Production
        : braintree.Environment.Sandbox,
    merchantId,
    publicKey,
    privateKey,
  });
}

function getNowPaymentsApiKey() {
  return (process.env.NOWPAYMENTS_API_KEY || "").trim();
}

function nowPaymentsEnabled() {
  return Boolean(getNowPaymentsApiKey()) && getNowPaymentsCurrencies().length > 0;
}

function getNowPaymentsCurrencyLabel(code) {
  const normalized = String(code || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "btc") return "BTC";
  if (normalized === "eth") return "ETH";
  if (normalized.startsWith("usdt")) return "USDT";
  if (normalized.startsWith("usdc")) return "USDC";
  return normalized.toUpperCase();
}

function getNowPaymentsCurrencyCodes() {
  const raw = process.env.NOWPAYMENTS_DEFAULT_CURRENCIES;
  if (!raw) return DEFAULT_NOWPAYMENTS_CURRENCIES;
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

function getNowPaymentsCurrencies() {
  const seenLabels = new Set();

  return getNowPaymentsCurrencyCodes()
    .map((code) => ({
      code,
      label: getNowPaymentsCurrencyLabel(code),
    }))
    .filter(
      ({ label }) =>
        label &&
        NOWPAYMENTS_DISPLAY_CURRENCIES.has(label) &&
        !seenLabels.has(label) &&
        seenLabels.add(label)
    )
    .sort(
      (a, b) =>
        NOWPAYMENTS_DISPLAY_ORDER.indexOf(a.label) -
        NOWPAYMENTS_DISPLAY_ORDER.indexOf(b.label)
    );
}

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

router.get("/info", async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId }).select(
      "coins itemsOwned settings"
    );
    
    const shopItems = await getShopItems();
    const avatarItems = shopItems
      .filter((item) => String(item.key || "").startsWith("avatar-"))
      .map((item) => {
        const key = String(item.key || "");
        const absolutePath = `${process.env.UPLOAD_PATH}/store/avatars/${key}.webp`;
        return {
          key,
          name: item.name,
          price: Number(item.price || 0),
          description: item.desc || "",
          owned: Number(user?.itemsOwned?.[key] || 0) > 0,
          available: fs.existsSync(absolutePath),
          imageUrl: buildAvatarImageUrl(key),
        };
      });

    res.send({
      shopItems: shopItems,
      avatarItems,
      equippedAvatarKey: String(user?.settings?.equippedAvatarKey || ""),
      balance: Number(user?.coins || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading shop data.");
  }
});

router.get("/buyCoins/config", async function (req, res) {
  try {
    await routeUtils.verifyLoggedIn(req);
    const braintreeEnabled = Boolean(getBraintreeGateway());
    const nowPaymentsCurrencies = getNowPaymentsCurrencies();
    const nowPayments = nowPaymentsEnabled();
    res.send({
      enabled: braintreeEnabled || nowPayments,
      braintreeEnabled,
      nowPaymentsEnabled: nowPayments,
      nowPaymentsCurrencies,
      minAmount: 50,
      maxAmount: 5000,
      pricePerCoin: 0.01
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading coin config.");
  }
});

router.post("/buyCoins/nowpayments/createInvoice", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const apiKey = getNowPaymentsApiKey();
    if (!apiKey) {
      res.status(503).send("NowPayments is currently unavailable.");
      return;
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 50 || amount > 5000 || amount % 50 !== 0) {
      res.status(400).send("Invalid amount (min 50, max 5000, multiple of 50).");
      return;
    }
    const price = amount * 0.01;

    const supportedCurrencies = getNowPaymentsCurrencies();
    if (!supportedCurrencies.length) {
      res.status(503).send("No crypto payment currencies are configured.");
      return;
    }

    const requestedCurrency = String(req.body.payCurrency || "")
      .trim()
      .toLowerCase();
    const selectedCurrency =
      supportedCurrencies.find((currency) => currency.code === requestedCurrency) ||
      supportedCurrencies[0];
    const payCurrency = selectedCurrency.code;

    const orderId = `um_buycoins:${userId}:${amount}:${shortid.generate()}`;
    const payload = {
      price_amount: price,
      price_currency: "usd",
      pay_currency: payCurrency,
      order_id: orderId,
      order_description: `${amount} coins for ${userId}`,
    };

    if (process.env.NOWPAYMENTS_IPN_URL) {
      payload.ipn_callback_url = process.env.NOWPAYMENTS_IPN_URL;
    }

    const nowRes = await axios.post(`${NOWPAYMENTS_API_BASE}/payment`, payload, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    const payment = nowRes.data || {};
    const paymentId = String(payment.payment_id || "");
    if (!paymentId) {
      res.status(500).send("NowPayments did not return a payment ID.");
      return;
    }

    await models.CoinPurchase.updateOne(
      { provider: "nowpayments", externalId: paymentId },
      {
        $setOnInsert: {
          id: shortid.generate(),
          userId,
          provider: "nowpayments",
          externalId: paymentId,
          amount: amount,
          coins: amount,
          amountUsd: price,
          status: "pending",
          rawStatus: String(payment.payment_status || "waiting"),
          raw: payment,
          createdAt: Date.now(),
        },
      },
      { upsert: true }
    ).exec();

    res.send({
      paymentId,
      status: payment.payment_status || "waiting",
      invoiceUrl: payment.invoice_url || "",
      payAddress: payment.pay_address || "",
      payAmount: payment.pay_amount || "",
      payCurrency: payment.pay_currency || payCurrency,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error creating NowPayments invoice.");
  }
});

router.post("/buyCoins/nowpayments/claim", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const apiKey = getNowPaymentsApiKey();
    if (!apiKey) {
      res.status(503).send("NowPayments is currently unavailable.");
      return;
    }

    const paymentId = String(req.body.paymentId || "").trim();
    if (!paymentId) {
      res.status(400).send("Missing payment ID.");
      return;
    }

    const nowRes = await axios.get(
      `${NOWPAYMENTS_API_BASE}/payment/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    const payment = nowRes.data || {};
    const paymentStatus = String(payment.payment_status || "").toLowerCase();
    const orderId = String(payment.order_id || "");
    const orderParts = orderId.split(":");
    if (orderParts.length < 4 || orderParts[0] !== "um_buycoins") {
      res.status(400).send("Invalid payment order metadata.");
      return;
    }

    const orderUserId = orderParts[1];
    const amountStr = orderParts[2];
    if (orderUserId !== userId) {
      res.status(403).send("This payment belongs to a different account.");
      return;
    }

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 50 || amount > 5000 || amount % 50 !== 0) {
      res.status(400).send("Invalid amount in payment metadata.");
      return;
    }

    if (!NOWPAYMENTS_SUCCESS_STATUSES.has(paymentStatus)) {
      res.status(409).send({
        status: paymentStatus || "unknown",
        message: `Payment status is '${paymentStatus || "unknown"}'. Coins will be added once confirmed.`,
      });
      return;
    }

    const existing = await models.CoinPurchase.findOne({
      provider: "nowpayments",
      externalId: paymentId,
    })
      .select("status userId")
      .lean()
      .exec();

    if (existing && existing.userId !== userId) {
      res.status(403).send("This payment belongs to a different account.");
      return;
    }

    if (existing && existing.status === "credited") {
      const updatedUser = await models.User.findOne({ id: userId }).select("coins");
      res.send({
        success: true,
        alreadyCredited: true,
        coinsAdded: 0,
        balance: updatedUser?.coins || 0,
      });
      return;
    }

    if (!existing) {
      try {
        await models.CoinPurchase.create({
          id: shortid.generate(),
          userId,
          provider: "nowpayments",
          externalId: paymentId,
          amount: amount,
          coins: amount,
          amountUsd: amount * 0.01,
          status: "pending",
          rawStatus: paymentStatus,
          raw: payment,
          createdAt: Date.now(),
        });
      } catch (createErr) {
        if (createErr.code !== 11000) {
          throw createErr;
        }
      }
    }

    const markCredited = await models.CoinPurchase.updateOne(
      {
        provider: "nowpayments",
        externalId: paymentId,
        status: { $ne: "credited" },
      },
      {
        $set: {
          userId,
          amount: amount,
          coins: amount,
          amountUsd: amount * 0.01,
          status: "credited",
          rawStatus: paymentStatus,
          raw: payment,
          creditedAt: Date.now(),
        },
      }
    ).exec();

    const changed =
      markCredited.modifiedCount ??
      markCredited.nModified ??
      markCredited.matchedCount ??
      0;

    if (!changed) {
      const updatedUser = await models.User.findOne({ id: userId }).select("coins");
      res.send({
        success: true,
        alreadyCredited: true,
        coinsAdded: 0,
        balance: updatedUser?.coins || 0,
      });
      return;
    }

    try {
      await models.User.updateOne(
        { id: userId },
        { $inc: { coins: amount } }
      ).exec();
      await redis.cacheUserInfo(userId, true);
    } catch (creditErr) {
      await models.CoinPurchase.updateOne(
        { provider: "nowpayments", externalId: paymentId },
        {
          $set: {
            status: "pending",
            creditedAt: null,
          },
        }
      ).exec();
      throw creditErr;
    }

    const updatedUser = await models.User.findOne({ id: userId }).select("coins");
    res.send({
      success: true,
      coinsAdded: amount,
      balance: updatedUser?.coins || 0,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error finalizing NowPayments purchase.");
  }
});

router.get("/buyCoins/token", async function (req, res) {
  try {
    await routeUtils.verifyLoggedIn(req);
    const gateway = getBraintreeGateway();
    if (!gateway) {
      res.status(503).send("Coin purchases are currently unavailable.");
      return;
    }

    const response = await gateway.clientToken.generate({});
    res.send({ clientToken: response.clientToken });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error generating payment token.");
  }
});

router.post("/buyCoins/checkout", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const gateway = getBraintreeGateway();
    if (!gateway) {
      res.status(503).send("Coin purchases are currently unavailable.");
      return;
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 50 || amount > 5000 || amount % 50 !== 0) {
      res.status(400).send("Invalid amount (min 50, max 5000, multiple of 50).");
      return;
    }
    const price = amount * 0.01;
    const paymentMethodNonce = String(req.body.paymentMethodNonce || "");
    if (!paymentMethodNonce) {
      res.status(400).send("Missing payment method.");
      return;
    }

    const saleResult = await gateway.transaction.sale({
      amount: price.toFixed(2),
      paymentMethodNonce,
      options: {
        submitForSettlement: true,
      },
    });

    if (!saleResult.success) {
      res.status(400).send(saleResult.message || "Payment failed.");
      return;
    }

    await models.User.updateOne(
      { id: userId },
      { $inc: { coins: amount } }
    ).exec();
    await redis.cacheUserInfo(userId, true);

    const updatedUser = await models.User.findOne({ id: userId }).select("coins");
    res.send({
      success: true,
      coinsAdded: amount,
      balance: updatedUser?.coins || 0,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error completing coin purchase.");
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
        "coins itemsOwned"
      );

      if (user.coins < item.price) {
        res.status(500);
        res.send("You do not have enough coins to purchase this.");
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
        coins: -1 * item.price,
      };

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

      res.send(context || {});
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
