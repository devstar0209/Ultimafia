const models = require("../db/models");

const STRIPE_CONFIG_FIELDS = ["apiKey", "publicKey"];

async function getPaymentMethod() {
  return models.PaymentMethod.findOne({
    provider: "stripe",
    active: true,
  })
    .select(
      [
        "apiKey",
        "publicKey",
        "test_apiKey",
        "test_publicKey",
        "mode",
        "environments",
      ].join(" ")
    )
    .lean();
}

function hasPrefixedTestConfig(paymentMethod = {}) {
  return STRIPE_CONFIG_FIELDS.some((field) =>
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

async function getClientConfig() {
  const paymentMethod = await getPaymentMethod();

  if(Boolean(paymentMethod))
    return {
      enabled: Boolean(getPaymentConfigValue(paymentMethod, "apiKey")),
      publicKey: getPaymentConfigValue(paymentMethod, "publicKey"),
      mode: paymentMethod?.mode || "test",
    };
  else return {
    enabled: false,
    publicKey: "",
    mode: "test",
  };
}

module.exports = {
  getClientConfig,
};
