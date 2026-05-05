const express = require("express");

const routeUtils = require("./utils");
const braintree = require("./braintree");
const nowpayment = require("./nowpayment");
const stripe = require("./stripe");
const models = require("../db/models");
const defaultSettings = require("../lib/defaultSettings");
const logger = require("../modules/logging")(".");

const router = express.Router();

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
    const forwardedProto = String(req.get("x-forwarded-proto") || "")
      .split(",")[0]
      .trim();
    const protocol = forwardedProto || req.protocol;
    const ipnCallbackUrl = `${protocol}://${req.get("host")}/api/nowpayments_ipn`;

    res.send(
      await nowpayment.createCoinPayment(
        userId,
        amount,
        requestedCurrency,
        ipnCallbackUrl
      )
    );
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error creating NowPayments invoice."
    );
  }
});

router.post("/nowpayments/claim", async function (req, res) {
  try {
    const userId = await routeUtils.verifyLoggedIn(req);
    const paymentId = String(req.body.paymentId || "").trim();
    if (!paymentId) {
      res.status(400).send("Missing payment ID.");
      return;
    }

    const result = await nowpayment.claimCoinPayment(userId, paymentId);
    if (!result.success) {
      res.status(409).send({
        status: result.status,
        message: result.message,
      });
      return;
    }

    res.send(result);
  } catch (e) {
    logger.error(e);
    res.status(e.statusCode || 500).send(
      e.statusCode ? e.message : "Error finalizing NowPayments purchase."
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
