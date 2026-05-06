const express = require("express");

const routeUtils = require("./utils");
const braintree = require("./braintree");
const nowpayment = require("./nowpayment");
const stripe = require("./stripe");
const models = require("../db/models");
const redis = require("../modules/redis");
const defaultSettings = require("../lib/defaultSettings");
const logger = require("../modules/logging")(".");

const router = express.Router();

function normalizeDollarAmount(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return null;

  return Math.round(number * 100) / 100;
}

router.get("/config", async function (req, res) {
  try {
    await routeUtils.verifyLoggedIn(req);

    const [
      braintreeConfig,
      nowPaymentsConfig,
      stripeConfig,
    ] = await Promise.all([
      braintree.getClientConfig(),
      nowpayment.getClientConfig(),
      stripe.getClientConfig(),
    ]);

    const settings = await defaultSettings.getSettings(models);
    const coinsPerDollar = Number(settings.coinsPerDollar || 100);
    const pricePerCoin = coinsPerDollar > 0 ? 1 / coinsPerDollar : 0.01;

    if (braintreeConfig.enabled) {
      var cardProvider = {
        id: "braintree",
        title: "Braintree",
        publicKey: braintreeConfig.publicKey,
      };
    }

    if (stripeConfig.enabled) {
      var cardProvider = {
        id: "stripe",
        title: "Stripe",
        publicKey: stripeConfig.publicKey,
      };
    }

    var paymentMethods = [];
    if (cardProvider) {
      paymentMethods.push({
        id: "card",
        optionLabel: "Option 1",
        title: "Card Payment",
        subtitle: "Pay by card",
        provider: cardProvider,
      });
    }

    if (nowPaymentsConfig.enabled === true) {
      paymentMethods.push({
        id: "crypto",
        optionLabel: "Option 2",
        title: "Crypto Payment",
        subtitle: "Pay with supported cryptocurrencies.",
        provider: {
          id: "nowpayments",
          title: "NowPayments",
          currencies: nowPaymentsConfig.currencies,
          minimumPaymentAmount: nowPaymentsConfig.minimumPaymentAmount,
          minimumPaymentAmounts: nowPaymentsConfig.minimumPaymentAmounts,
        },
      });
    }

    res.send({
      paymentMethods,
      pricePerCoin,
      coinsPerDollar,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).send("Error loading coin config.");
  }
});

router.post("/nowpayments/createInvoice", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const amount = Number(req.body.amount);
    const requestedCurrency = String(req.body.payCurrency || "")
      .trim()
      .toLowerCase();

    res.send(
      await nowpayment.createCoinPayment(
        userId,
        amount,
        requestedCurrency
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error creating NowPayments invoice."
    );
  }
});

router.post("/nowpayments/createTopUp", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const amountUsd = normalizeDollarAmount(req.body.amountUsd);
    const requestedCurrency = String(req.body.payCurrency || "")
      .trim()
      .toLowerCase();

    res.send(
      await nowpayment.createBalanceTopUpPayment(
        userId,
        amountUsd,
        requestedCurrency
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error creating NowPayments top up."
    );
  }
});

router.get("/nowpayments/status/:paymentId", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    res.send(
      await nowpayment.getCoinPaymentStatus(
        userId,
        req.params.paymentId
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error checking NowPayments payment status."
    );
  }
});

router.post("/topup/checkout", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const amountUsd = normalizeDollarAmount(req.body.amountUsd);
    const paymentMethodNonce = String(req.body.paymentMethodNonce || "");

    res.send(
      await braintree.checkoutBalanceTopUp(
        userId,
        amountUsd,
        paymentMethodNonce
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error completing balance top up."
    );
  }
});

router.post("/balance/buyCoins", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const amount = Number(req.body.amount);

    if (
      !Number.isInteger(amount) ||
      amount < 200 ||
      amount > 100000
    ) {
      res.status(400).send("Invalid coin amount.");
      return;
    }

    const settings = await defaultSettings.getSettings(models);
    const coinsPerDollar = Number(settings.coinsPerDollar || 100);
    const priceUsd = normalizeDollarAmount(
      amount / (coinsPerDollar > 0 ? coinsPerDollar : 100)
    );

    const debitResult = await models.User.updateOne(
      { id: userId, balanceDollar: { $gte: priceUsd } },
      {
        $inc: {
          balanceDollar: -priceUsd,
          coins: amount,
        },
      }
    ).exec();

    const changed =
      debitResult.modifiedCount ??
      debitResult.nModified ??
      debitResult.matchedCount ??
      0;

    if (!changed) {
      res.status(400).send("Insufficient dollar balance.");
      return;
    }

    await redis.cacheUserInfo(userId, true);

    const updatedUser = await models.User.findOne({ id: userId }).select(
      "coins balanceDollar"
    );

    res.send({
      success: true,
      coinsAdded: amount,
      priceUsd,
      balance: updatedUser?.coins || 0,
      balanceDollar: updatedUser?.balanceDollar || 0,
    });
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error buying coins."
    );
  }
});

router.get("/token", async function (req, res) {
  try {
    await routeUtils.verifyLoggedIn(req);
    res.send(await braintree.generateClientToken());
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error generating payment token."
    );
  }
});

router.post("/checkout", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const amount = Number(req.body.amount);
    const paymentMethodNonce = String(req.body.paymentMethodNonce || "");

    res.send(
      await braintree.checkoutCoinPurchase(
        userId,
        amount,
        paymentMethodNonce
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error completing coin purchase."
    );
  }
});

module.exports = router;
