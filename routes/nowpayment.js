const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const shortid = require("shortid");

const models = require("../db/models");
const redis = require("../modules/redis");
const defaultSettings = require("../lib/defaultSettings");
const logger = require("../modules/logging")(".");

const router = express.Router();

const DEFAULT_NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";
const NOWPAYMENTS_SUCCESS_STATUSES = new Set(["finished"]);
const NOWPAYMENTS_CONFIG_FIELDS = [
  "apiKey",
  "baseUrl",
  "defaultCurrencies",
  "ipnSecretKey",
];

function normalizeNowPaymentsApiBase(baseUrl) {
  const trimmed = String(baseUrl || DEFAULT_NOWPAYMENTS_API_BASE)
    .trim()
    .replace(/\/+$/, "");

  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function hasPrefixedTestConfig(paymentMethod = {}) {
  return NOWPAYMENTS_CONFIG_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(paymentMethod, `test_${field}`)
  );
}

function getPaymentConfigValue(paymentMethod = {}, field) {
  const mode = String(paymentMethod.mode || "test").toLowerCase();
  const environment = paymentMethod.environments?.[mode] || {};

  if (mode === "test") {
    if (hasPrefixedTestConfig(paymentMethod)) {
      return paymentMethod[`test_${field}`] || environment[field] || "";
    }

    if (paymentMethod.environments?.test) {
      return environment[field] || "";
    }
  }

  return paymentMethod[field] || environment[field] || "";
}

async function getNowPaymentsConfig() {
  const paymentMethod = await models.PaymentMethod.findOne({
    provider: "nowpayments",
  })
    .select(
      [
        "active",
        "mode",
        "apiKey",
        "publicKey",
        "baseUrl",
        "defaultCurrencies",
        "ipnSecretKey",
        "test_apiKey",
        "test_publicKey",
        "test_baseUrl",
        "test_defaultCurrencies",
        "test_ipnSecretKey",
      ].join(" ")
    )
    .lean();

  if (!paymentMethod?.active) return null;

  const settings = await defaultSettings.getSettings(models);
  const coinsPerDollar = Number(settings.coinsPerDollar || 100);

  return {
    active: true,
    mode: String(paymentMethod.mode || "test").toLowerCase(),
    apiKey: String(getPaymentConfigValue(paymentMethod, "apiKey")).trim(),
    apiBase: normalizeNowPaymentsApiBase(
      getPaymentConfigValue(paymentMethod, "baseUrl")
    ),
    defaultCurrencies: String(
      getPaymentConfigValue(paymentMethod, "defaultCurrencies")
    ).trim(),
    ipnSecretKey: String(
      getPaymentConfigValue(paymentMethod, "ipnSecretKey")
    ).trim(),
    coinsPerDollar: coinsPerDollar > 0 ? coinsPerDollar : 100,
  };
}

function getNowPaymentsCurrencyCodes(config) {
  const raw = config?.defaultCurrencies;
  if (!raw) return [];

  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

function nowPaymentsEnabled(config) {
  return Boolean(config?.active && config?.apiKey && getNowPaymentsCurrencyCodes(config).length > 0);
}

async function getMinimumPaymentAmount(config, currency) {
  try {
    const nowRes = await axios.get(`${config.apiBase}/min-amount`, {
      params: {
        currency_from: "usd",
        currency_to: currency,
        fiat_equivalent: "usd",
        is_fixed_rate: true,
        is_fee_paid_by_user: true,
      },
      headers: {
        "x-api-key": config.apiKey,
      },
      timeout: 5000,
    });

    const data = nowRes.data || {};
    const minAmount = Number(data.min_amount);
    const fiatEquivalent = Number(data.fiat_equivalent);
    const amountUsd = Number.isFinite(fiatEquivalent)
      ? fiatEquivalent
      : minAmount;

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;

    return {
      currency,
      amount: Number.isFinite(minAmount) ? minAmount : amountUsd,
      fiatEquivalent: amountUsd,
    };
  } catch (e) {
    logger.warn(
      `Error fetching NowPayments minimum amount for ${currency}: ${
        e.response?.data?.message || e.message || e
      }`
    );
    return null;
  }
}

async function getMinimumPaymentAmounts(config) {
  if (!nowPaymentsEnabled(config)) return [];

  const currencies = getNowPaymentsCurrencyCodes(config);
  const minimumAmounts = await Promise.all(
    currencies.map((currency) => getMinimumPaymentAmount(config, currency))
  );

  return minimumAmounts.filter(Boolean);
}

async function getClientConfig() {
  const config = await getNowPaymentsConfig();
  const minimumAmounts = await getMinimumPaymentAmounts(config);
  const requiredMinimumAmount = minimumAmounts.reduce((highest, amount) => {
    if (!highest || amount.fiatEquivalent > highest.fiatEquivalent) {
      return amount;
    }

    return highest;
  }, null);

  return {
    enabled: nowPaymentsEnabled(config),
    currencies: getNowPaymentsCurrencyCodes(config),
    minimumPaymentAmount: requiredMinimumAmount,
    minimumPaymentAmounts: minimumAmounts,
  };
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObject(value[key]);
        return result;
      }, {});
  }

  return value;
}

function verifyNowPaymentsSignature(body, signature, ipnSecretKey) {
  if (!signature || !ipnSecretKey) return false;

  const hmac = crypto.createHmac("sha512", ipnSecretKey);
  hmac.update(JSON.stringify(sortObject(body)));
  const expected = hmac.digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(String(signature), "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function parseNowPaymentsOrder(payment, expectedUserId) {
  const paymentId = String(payment.payment_id || "").trim();
  if (!paymentId) {
    const error = new Error("Missing payment ID.");
    error.statusCode = 400;
    throw error;
  }

  const orderId = String(payment.order_id || "");
  const orderParts = orderId.split(":");
  if (orderParts.length < 4 || orderParts[0] !== "pm") {
    const error = new Error("Invalid payment order metadata.");
    error.statusCode = 400;
    throw error;
  }

  const userId = orderParts[1];
  const amount = Number(orderParts[2]);
  if (expectedUserId && userId !== expectedUserId) {
    const error = new Error("This payment belongs to a different account.");
    error.statusCode = 403;
    throw error;
  }

  return {
    paymentId,
    userId,
    amount,
    paymentStatus: String(payment.payment_status || "").toLowerCase(),
  };
}

async function syncNowPaymentsPurchase(payment, expectedUserId) {
  const { paymentId, userId, amount, paymentStatus } = parseNowPaymentsOrder(
    payment,
    expectedUserId
  );
  const config = await getNowPaymentsConfig();
  const amountUsd = amount / config.coinsPerDollar;

  await models.CoinPurchase.updateOne(
    { provider: "nowpayments", externalId: paymentId },
    {
      $setOnInsert: {
        id: shortid.generate(),
        userId,
        provider: "nowpayments",
        externalId: paymentId,
        amount,
        coins: amount,
        amountUsd,
        status: "pending",
        createdAt: Date.now(),
      },
      $set: {
        rawStatus: paymentStatus || "unknown",
        raw: payment,
      },
    },
    { upsert: true }
  ).exec();

  const existing = await models.CoinPurchase.findOne({
    provider: "nowpayments",
    externalId: paymentId,
  })
    .select("status userId")
    .lean()
    .exec();

  if (existing && existing.userId !== userId) {
    const error = new Error("This payment belongs to a different account.");
    error.statusCode = 403;
    throw error;
  }

  if (!NOWPAYMENTS_SUCCESS_STATUSES.has(paymentStatus)) {
    return {
      success: false,
      status: paymentStatus || "unknown",
      message: `Payment status is '${paymentStatus || "unknown"}'. Coins will be added once confirmed.`,
    };
  }

  if (existing && existing.status === "credited") {
    const updatedUser = await models.User.findOne({ id: userId }).select("coins");
    return {
      success: true,
      alreadyCredited: true,
      coinsAdded: 0,
      balance: updatedUser?.coins || 0,
    };
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
        amount,
        coins: amount,
        amountUsd,
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
    return {
      success: true,
      alreadyCredited: true,
      coinsAdded: 0,
      balance: updatedUser?.coins || 0,
    };
  }

  try {
    await models.User.updateOne({ id: userId }, { $inc: { coins: amount } }).exec();
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
  return {
    success: true,
    coinsAdded: amount,
    balance: updatedUser?.coins || 0,
  };
}

async function createCoinPayment(userId, amount, requestedCurrency) {
  const config = await getNowPaymentsConfig();
  if (!nowPaymentsEnabled(config)) {
    const error = new Error("NowPayments is currently unavailable.");
    error.statusCode = 503;
    throw error;
  }

  const supportedCurrencies = getNowPaymentsCurrencyCodes(config);
  const selectedCurrency =
    supportedCurrencies.find((currency) => currency === requestedCurrency) ||
    supportedCurrencies[0];
  const payCurrency = selectedCurrency;
  const price = amount / config.coinsPerDollar;
  const orderId = `pm:${userId}:${amount}:${shortid.generate()}`;
  
  const payload = {
    price_amount: price,
    price_currency: "usd",
    pay_currency: payCurrency,
    order_id: orderId,
    order_description: `${amount} coins for ${userId}`,
    is_fee_paid_by_user: true,
    is_fixed_rate: true,
  };

  try {
    var nowRes = await axios.post(`${config.apiBase}/payment`, payload, {
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    logger.error("Error creating NowPayments invoice:", e.response?.data || e.message || e);
    const errorMessage = e.message || e ;
    const error = new Error(errorMessage);
    error.statusCode = e.response?.status || 500;
    throw error;
  }

  const payment = nowRes.data || {};
  const paymentId = String(payment.payment_id || "");
  const payAddress = String(payment.pay_address || "");
  const payAmount = payment.pay_amount || "";
  if (!paymentId || !payAddress || !payAmount) {
    const error = new Error("NowPayments did not return payment details.");
    error.statusCode = 500;
    throw error;
  }

  await syncNowPaymentsPurchase(payment, userId);

  return {
    paymentId,
    status: payment.payment_status || "waiting",
    invoiceUrl: payment.invoice_url || "",
    payAddress,
    payAmount,
    payCurrency: payment.pay_currency || payCurrency,
  };
}

router.post("/", async function (req, res) {
  try {
    const config = await getNowPaymentsConfig();
    if (!config?.ipnSecretKey) {
      res.status(503).send("NowPayments IPN is not configured.");
      return;
    }

    const signature = req.get("x-nowpayments-sig");
    if (!verifyNowPaymentsSignature(req.body || {}, signature, config.ipnSecretKey)) {
      res.status(401).send("Invalid NowPayments signature.");
      return;
    }

    const result = await syncNowPaymentsPurchase(req.body || {});
    res.send({
      ok: true,
      credited: Boolean(result.success && !result.alreadyCredited),
      status: result.status || "credited",
    });
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error processing NowPayments IPN."
    );
  }
});

module.exports = router;
module.exports.createCoinPayment = createCoinPayment;
module.exports.getClientConfig = getClientConfig;
