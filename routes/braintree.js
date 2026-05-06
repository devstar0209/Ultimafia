const braintree = require("braintree");

const models = require("../db/models");
const redis = require("../modules/redis");

const BRAINTREE_CONFIG_FIELDS = ["apiKey", "publicKey", "privateKey"];

async function getPaymentMethod() {
  return models.PaymentMethod.findOne({
    provider: "braintree",
    active: true,
  })
    .select(
      [
        "apiKey",
        "publicKey",
        "privateKey",
        "test_apiKey",
        "test_publicKey",
        "test_privateKey",
        "mode",
        "environments",
      ].join(" ")
    )
    .lean();
}

function hasPrefixedTestConfig(paymentMethod = {}) {
  return BRAINTREE_CONFIG_FIELDS.some((field) =>
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

async function getGateway() {
  const paymentMethod = await getPaymentMethod();
  if (!paymentMethod) return null;

  const merchantId = String(getPaymentConfigValue(paymentMethod, "apiKey")).trim();
  const publicKey = String(
    getPaymentConfigValue(paymentMethod, "publicKey")
  ).trim();
  const privateKey = String(
    getPaymentConfigValue(paymentMethod, "privateKey")
  ).trim();
  const mode = String(paymentMethod.mode || "test").toLowerCase();

  if (!merchantId || !publicKey || !privateKey) return null;

  return new braintree.BraintreeGateway({
    environment:
      mode === "prod"
        ? braintree.Environment.Production
        : braintree.Environment.Sandbox,
    merchantId,
    publicKey,
    privateKey,
  });
}

async function getClientConfig() {
  return {
    enabled: Boolean(await getGateway()),
  };
}

async function generateClientToken() {
  const gateway = await getGateway();
  if (!gateway) {
    const error = new Error("Coin purchases are currently unavailable.");
    error.statusCode = 503;
    throw error;
  }

  const response = await gateway.clientToken.generate({});
  return { clientToken: response.clientToken };
}

async function checkoutCoinPurchase(userId, amount, paymentMethodNonce) {
  const gateway = await getGateway();
  if (!gateway) {
    const error = new Error("Coin purchases are currently unavailable.");
    error.statusCode = 503;
    throw error;
  }

  if (!Number.isFinite(amount) || amount < 50 || amount > 5000 || amount % 50 !== 0) {
    const error = new Error("Invalid amount (min 50, max 5000, multiple of 50).");
    error.statusCode = 400;
    throw error;
  }

  if (!paymentMethodNonce) {
    const error = new Error("Missing payment method.");
    error.statusCode = 400;
    throw error;
  }

  const saleResult = await gateway.transaction.sale({
    amount: (amount * 0.01).toFixed(2),
    paymentMethodNonce,
    options: {
      submitForSettlement: true,
    },
  });

  if (!saleResult.success) {
    const error = new Error(saleResult.message || "Payment failed.");
    error.statusCode = 400;
    throw error;
  }

  await models.User.updateOne({ id: userId }, { $inc: { coins: amount } }).exec();
  await redis.cacheUserInfo(userId, true);

  const updatedUser = await models.User.findOne({ id: userId }).select("coins");
  return {
    success: true,
    coinsAdded: amount,
    balance: updatedUser?.coins || 0,
  };
}

function normalizeDollarAmount(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return null;

  return Math.round(number * 100) / 100;
}

async function checkoutBalanceTopUp(userId, amountUsd, paymentMethodNonce) {
  const gateway = await getGateway();
  if (!gateway) {
    const error = new Error("Top ups are currently unavailable.");
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

  if (!paymentMethodNonce) {
    const error = new Error("Missing payment method.");
    error.statusCode = 400;
    throw error;
  }

  const saleResult = await gateway.transaction.sale({
    amount: normalizedAmount.toFixed(2),
    paymentMethodNonce,
    options: {
      submitForSettlement: true,
    },
  });

  if (!saleResult.success) {
    const error = new Error(saleResult.message || "Payment failed.");
    error.statusCode = 400;
    throw error;
  }

  await models.User.updateOne(
    { id: userId },
    { $inc: { balanceDollar: normalizedAmount } }
  ).exec();
  await redis.cacheUserInfo(userId, true);

  const updatedUser = await models.User.findOne({ id: userId }).select(
    "balanceDollar"
  );
  return {
    success: true,
    balanceDollarAdded: normalizedAmount,
    balanceDollar: updatedUser?.balanceDollar || 0,
  };
}

module.exports = {
  checkoutCoinPurchase,
  checkoutBalanceTopUp,
  generateClientToken,
  getClientConfig,
};
