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
const NOWPAYMENTS_BALANCE_ORDER_PREFIX = "topup";
const NOWPAYMENTS_COIN_ORDER_PREFIX = "pm";

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
  const orderPrefix = orderParts[0];
  if (
    orderParts.length < 4 ||
    ![NOWPAYMENTS_COIN_ORDER_PREFIX, NOWPAYMENTS_BALANCE_ORDER_PREFIX].includes(
      orderPrefix
    )
  ) {
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
    purchaseType:
      orderPrefix === NOWPAYMENTS_BALANCE_ORDER_PREFIX
        ? "balanceDollar"
        : "coins",
    paymentStatus: String(payment.payment_status || "").toLowerCase(),
  };
}

async function syncNowPaymentsPurchase(payment, expectedUserId) {
  const { paymentId, userId, amount, purchaseType, paymentStatus } =
    parseNowPaymentsOrder(payment, expectedUserId);
  const config = await getNowPaymentsConfig();
  const isBalanceTopUp = purchaseType === "balanceDollar";
  const coins = isBalanceTopUp ? 0 : amount;
  const amountUsd = isBalanceTopUp ? amount : amount / config.coinsPerDollar;

  await models.CoinPurchase.updateOne(
    { provider: "nowpayments", externalId: paymentId },
    {
      $setOnInsert: {
        id: shortid.generate(),
        userId,
        provider: "nowpayments",
        externalId: paymentId,
        purchaseType,
        amount: coins,
        coins,
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
    .select("status userId purchaseType")
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
      purchaseType,
      status: paymentStatus || "unknown",
      message: `Payment status is '${paymentStatus || "unknown"}'. Balance will be updated once confirmed.`,
    };
  }

  if (existing && existing.status === "credited") {
    const updatedUser = await models.User.findOne({ id: userId }).select(
      "coins balanceDollar"
    );
    return {
      success: true,
      purchaseType,
      alreadyCredited: true,
      coinsAdded: 0,
      balance: updatedUser?.coins || 0,
      balanceDollarAdded: 0,
      balanceDollar: updatedUser?.balanceDollar || 0,
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
        amount: coins,
        coins,
        amountUsd,
        status: "credited",
        rawStatus: paymentStatus,
        raw: payment,
        creditedAt: Date.now(),
        purchaseType,
      },
    }
  ).exec();

  const changed =
    markCredited.modifiedCount ??
    markCredited.nModified ??
    markCredited.matchedCount ??
    0;

  if (!changed) {
    const updatedUser = await models.User.findOne({ id: userId }).select(
      "coins balanceDollar"
    );
    return {
      success: true,
      purchaseType,
      alreadyCredited: true,
      coinsAdded: 0,
      balance: updatedUser?.coins || 0,
      balanceDollarAdded: 0,
      balanceDollar: updatedUser?.balanceDollar || 0,
    };
  }

  try {
    await models.User.updateOne(
      { id: userId },
      { $inc: isBalanceTopUp ? { balanceDollar: amountUsd } : { coins } }
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

  const updatedUser = await models.User.findOne({ id: userId }).select(
    "coins balanceDollar"
  );

  if (isBalanceTopUp) {
    return {
      success: true,
      purchaseType,
      balanceDollarAdded: amountUsd,
      balanceDollar: updatedUser?.balanceDollar || 0,
    };
  }

  return {
    success: true,
    purchaseType,
    coinsAdded: coins,
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

function normalizeDollarAmount(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return null;

  return Math.round(number * 100) / 100;
}

async function createBalanceTopUpPayment(userId, amountUsd, requestedCurrency) {
  const config = await getNowPaymentsConfig();
  if (!nowPaymentsEnabled(config)) {
    const error = new Error("NowPayments is currently unavailable.");
    error.statusCode = 503;
    throw error;
  }

  const normalizedAmount = normalizeDollarAmount(amountUsd);
  if (
    !Number.isFinite(normalizedAmount) ||
    normalizedAmount < 1 ||
    normalizedAmount > 500 ||
    normalizedAmount !== Number(amountUsd)
  ) {
    const error = new Error("Invalid top up amount (min $1, max $500).");
    error.statusCode = 400;
    throw error;
  }

  const supportedCurrencies = getNowPaymentsCurrencyCodes(config);
  const selectedCurrency =
    supportedCurrencies.find((currency) => currency === requestedCurrency) ||
    supportedCurrencies[0];
  const payCurrency = selectedCurrency;
  const orderId = `${NOWPAYMENTS_BALANCE_ORDER_PREFIX}:${userId}:${normalizedAmount}:${shortid.generate()}`;

  const payload = {
    price_amount: normalizedAmount,
    price_currency: "usd",
    pay_currency: payCurrency,
    order_id: orderId,
    order_description: `$${normalizedAmount.toFixed(2)} balance top up for ${userId}`,
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
    logger.error("Error creating NowPayments top up:", e.response?.data || e.message || e);
    const error = new Error(e.message || e);
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

async function getCoinPaymentStatus(userId, paymentId) {
  const normalizedPaymentId = String(paymentId || "").trim();
  if (!normalizedPaymentId) {
    const error = new Error("Missing payment ID.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await models.CoinPurchase.findOne({
    provider: "nowpayments",
    externalId: normalizedPaymentId,
    userId,
  })
    .select("raw rawStatus status purchaseType")
    .lean()
    .exec();

  if (!existing) {
    const error = new Error("Payment not found.");
    error.statusCode = 404;
    throw error;
  }

  if (existing.status === "credited") {
    const updatedUser = await models.User.findOne({ id: userId }).select(
      "coins balanceDollar"
    );
    return {
      success: true,
      purchaseType: existing.purchaseType || "coins",
      alreadyCredited: true,
      coinsAdded: 0,
      balance: updatedUser?.coins || 0,
      balanceDollarAdded: 0,
      balanceDollar: updatedUser?.balanceDollar || 0,
      status: existing.rawStatus || "finished",
    };
  }

  const config = await getNowPaymentsConfig();
  if (!nowPaymentsEnabled(config)) {
    const error = new Error("NowPayments is currently unavailable.");
    error.statusCode = 503;
    throw error;
  }

  let payment;
  try {
    const nowRes = await axios.get(
      `${config.apiBase}/payment/${encodeURIComponent(normalizedPaymentId)}`,
      {
        headers: {
          "x-api-key": config.apiKey,
        },
      }
    );
    payment = {
      ...(existing.raw || {}),
      ...(nowRes.data || {}),
    };
  } catch (e) {
    logger.error("Error fetching NowPayments payment status:", e.response?.data || e.message || e);
    const error = new Error(e.message || e);
    error.statusCode = e.response?.status || 500;
    throw error;
  }

  const result = await syncNowPaymentsPurchase(payment, userId);

  return {
    ...result,
    status: result.status || String(payment.payment_status || "").toLowerCase(),
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
module.exports.createBalanceTopUpPayment = createBalanceTopUpPayment;
module.exports.getCoinPaymentStatus = getCoinPaymentStatus;
module.exports.getClientConfig = getClientConfig;
