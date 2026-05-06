import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { SiteInfoContext } from "Contexts";
import { useErrorAlert } from "components/Alerts";

const MIN_TOP_UP_AMOUNT = 1;

const buildCryptoCurrencies = (currencies = []) => {
  return currencies
    .map((entry) => {
      const code =
        typeof entry === "string" ? entry : entry?.code || entry?.currency || "";

      return {
        code,
        label:
          typeof entry === "string"
            ? entry.toUpperCase()
            : entry?.label || entry?.name || code,
        icon: typeof entry === "string" ? "" : entry?.icon || "",
      };
    })
    .filter((currency) => currency.code);
};

const formatUsdAmount = (amount) => {
  const number = Number(amount);
  if (!Number.isFinite(number)) return "";

  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function TopUpModal({ open, onClose, user }) {
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const [topUpConfig, setTopUpConfig] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("");
  const [nowPaymentsCurrency, setNowPaymentsCurrency] = useState("");
  const [nowPaymentsPaymentId, setNowPaymentsPaymentId] = useState("");
  const [nowPaymentsStatus, setNowPaymentsStatus] = useState("");
  const [nowPaymentsSuccessMessage, setNowPaymentsSuccessMessage] = useState("");
  const [nowPaymentsInvoiceUrl, setNowPaymentsInvoiceUrl] = useState("");
  const [payAddress, setPayAddress] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [dropInInstance, setDropInInstance] = useState(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const isMountedRef = useRef(false);
  const dropInContainerRef = useRef(null);

  const paymentMethods = useMemo(
    () => (Array.isArray(topUpConfig?.paymentMethods) ? topUpConfig.paymentMethods : []),
    [topUpConfig]
  );
  const cardMethod = paymentMethods.find((method) => method.id === "card");
  const cryptoMethod = paymentMethods.find((method) => method.id === "crypto");
  const braintreeEnabled = Boolean(cardMethod?.provider?.id === "braintree");
  const stripeEnabled = Boolean(cardMethod?.provider?.id === "stripe");
  const cardEnabled = Boolean(cardMethod);
  const cryptoEnabled = Boolean(cryptoMethod);
  const cryptoProvider = cryptoMethod?.provider;
  const cryptoCurrencies = buildCryptoCurrencies(cryptoProvider?.currencies);
  const cryptoMinimumPaymentAmounts = Array.isArray(
    cryptoProvider?.minimumPaymentAmounts
  )
    ? cryptoProvider.minimumPaymentAmounts
    : [];
  const isCreatingCryptoPayment =
    isProcessingPurchase && paymentProvider === "crypto";
  const presetAmounts = [2, 5, 10, 20];
  const selectedAmountNumber = Number(selectedAmount);
  const hasSelectedAmount = selectedAmount !== "";
  const isTopUpAmountValid =
    hasSelectedAmount &&
    Number.isFinite(selectedAmountNumber) &&
    selectedAmountNumber >= MIN_TOP_UP_AMOUNT &&
    selectedAmountNumber <= 500 &&
    Math.round(selectedAmountNumber * 100) / 100 === selectedAmountNumber;
  const amountError = hasSelectedAmount && !isTopUpAmountValid;
  const selectedPrice = Number.isFinite(selectedAmountNumber)
    ? selectedAmountNumber.toFixed(2)
    : "0.00";

  const getMinimumPaymentAmountUsd = (currencyCode) => {
    const minimumPaymentAmount =
      cryptoMinimumPaymentAmounts.find(
        (amount) => amount.currency === currencyCode
      ) || cryptoProvider?.minimumPaymentAmount;
    const amountUsd = Number(minimumPaymentAmount?.fiatEquivalent);

    return Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : null;
  };

  const isBelowCryptoMinimumPaymentAmount = (currencyCode) => {
    const amountUsd = getMinimumPaymentAmountUsd(currencyCode);

    return (
      amountUsd !== null &&
      Number.isFinite(selectedAmountNumber) &&
      selectedAmountNumber < amountUsd
    );
  };

  const loadTopUpConfig = useCallback(() => {
    return axios
      .get("/api/payment/config")
      .then((res) => {
        if (!isMountedRef.current) return;
        setTopUpConfig(res.data);
      })
      .catch((e) => {
        if (isMountedRef.current) console.error("Unable to load top up config", e);
      });
  }, []);

  const loadBraintreeToken = useCallback(() => {
    return axios
      .get("/api/payment/token")
      .then((res) => {
        if (!isMountedRef.current) return;
        setClientToken(res.data.clientToken);
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      });
  }, [errorAlert]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setSelectedAmount("");
    setPaymentProvider("");
    setNowPaymentsCurrency("");
    setNowPaymentsPaymentId("");
    setNowPaymentsStatus("");
    setNowPaymentsSuccessMessage("");
    setNowPaymentsInvoiceUrl("");
    setPayAddress("");
    setPayAmount("");
    setPayCurrency("");
    setClientToken("");
    setDropInInstance(null);
    setIsProcessingPurchase(false);
    setTopUpConfig(null);

    loadTopUpConfig();
  }, [loadTopUpConfig, open]);

  useEffect(() => {
    if (!topUpConfig) return;
    if (paymentMethods.some((method) => method.id === paymentProvider)) return;
    if (paymentMethods.length > 0) setPaymentProvider(paymentMethods[0].id);
  }, [paymentMethods, paymentProvider, topUpConfig]);

  useEffect(() => {
    if (
      !open ||
      paymentProvider !== "card" ||
      !braintreeEnabled ||
      clientToken
    ) {
      return;
    }

    loadBraintreeToken();
  }, [open, paymentProvider, braintreeEnabled, clientToken, loadBraintreeToken]);

  useEffect(() => {
    if (
      !open ||
      paymentProvider !== "card" ||
      !clientToken ||
      !dropInContainerRef.current
    ) {
      return;
    }

    let cancelled = false;
    let activeInstance = null;

    const script = document.createElement("script");
    script.src = "https://js.braintreegateway.com/web/dropin/1.44.2/js/dropin.min.js";
    script.async = true;
    script.onload = () => {
      if (cancelled || !window.braintree?.dropin) return;
      window.braintree.dropin.create(
        {
          authorization: clientToken,
          container: dropInContainerRef.current,
          paypal: {
            flow: "checkout",
          },
        },
        (err, instance) => {
          if (err || cancelled || !isMountedRef.current) return;
          activeInstance = instance;
          setDropInInstance(instance);
        }
      );
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      if (activeInstance) activeInstance.teardown(() => {});
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [open, clientToken, paymentProvider]);

  const resetCryptoPayment = () => {
    setNowPaymentsPaymentId("");
    setNowPaymentsStatus("");
    setNowPaymentsSuccessMessage("");
    setNowPaymentsInvoiceUrl("");
    setPayAddress("");
    setPayAmount("");
    setPayCurrency("");
  };

  const handleAmountChange = (newAmount) => {
    setSelectedAmount(newAmount);
    resetCryptoPayment();
  };

  const generateCryptoTopUp = (currencyCode) => {
    if (
      !isTopUpAmountValid ||
      isBelowCryptoMinimumPaymentAmount(currencyCode)
    ) {
      return;
    }

    setPaymentProvider("crypto");
    setNowPaymentsCurrency(currencyCode);
    resetCryptoPayment();
    setIsProcessingPurchase(true);

    axios
      .post("/api/payment/nowpayments/createTopUp", {
        amountUsd: selectedAmountNumber,
        payCurrency: currencyCode,
      })
      .then((res) => {
        if (!isMountedRef.current) return;
        setNowPaymentsPaymentId(res.data.paymentId || "");
        setNowPaymentsStatus(res.data.status || "waiting");
        setNowPaymentsInvoiceUrl(res.data.invoiceUrl || "");
        setPayAddress(res.data.payAddress || "");
        setPayAmount(res.data.payAmount || "");
        setPayCurrency(res.data.payCurrency || currencyCode);
        if (res.data.invoiceUrl) {
          window.open(res.data.invoiceUrl, "_blank", "noopener,noreferrer");
        }
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  };

  const checkNowPaymentsStatus = useCallback(() => {
    if (!nowPaymentsPaymentId || nowPaymentsSuccessMessage) return;

    return axios
      .get(
        `/api/payment/nowpayments/status/${encodeURIComponent(
          nowPaymentsPaymentId
        )}`
      )
      .then((res) => {
        if (!isMountedRef.current) return;

        setNowPaymentsStatus(res.data.status || "");
        if (!res.data.success) return;

        user.set((prev) => ({
          ...prev,
          balanceDollar: res.data.balanceDollar,
        }));

        setNowPaymentsSuccessMessage(
          res.data.alreadyCredited
            ? "Payment confirmed. Your balance was already updated."
            : `Payment confirmed. ${formatUsdAmount(
                res.data.balanceDollarAdded
              )} was added to your balance.`
        );
      })
      .catch((e) => {
        if (isMountedRef.current) {
          console.error("Unable to check NowPayments status", e);
        }
      });
  }, [nowPaymentsPaymentId, nowPaymentsSuccessMessage, user]);

  useEffect(() => {
    if (
      !open ||
      paymentProvider !== "crypto" ||
      !nowPaymentsPaymentId ||
      nowPaymentsSuccessMessage
    ) {
      return undefined;
    }

    const interval = window.setInterval(checkNowPaymentsStatus, 10000);
    checkNowPaymentsStatus();

    return () => window.clearInterval(interval);
  }, [
    checkNowPaymentsStatus,
    nowPaymentsPaymentId,
    nowPaymentsSuccessMessage,
    open,
    paymentProvider,
  ]);

  const topUpWithBraintree = () => {
    if (!dropInInstance || !isTopUpAmountValid) return;

    setIsProcessingPurchase(true);
    dropInInstance
      .requestPaymentMethod()
      .then((payload) =>
        axios.post("/api/payment/topup/checkout", {
          amountUsd: selectedAmountNumber,
          paymentMethodNonce: payload.nonce,
        })
      )
      .then((res) => {
        if (!isMountedRef.current) return;
        user.set((prev) => ({
          ...prev,
          balanceDollar: res.data.balanceDollar,
        }));
        siteInfo.showAlert(
          `Added ${formatUsdAmount(res.data.balanceDollarAdded)} to your balance.`,
          "success"
        );
        onClose();
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Top Up Balance</DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {presetAmounts.map((amt) => (
              <Button
                key={amt}
                variant={selectedAmount === amt ? "contained" : "outlined"}
                onClick={() => handleAmountChange(amt)}
                size="small"
              >
                {formatUsdAmount(amt)}
              </Button>
            ))}
          </Stack>
          <TextField
            fullWidth
            label="Custom amount"
            type="number"
            value={selectedAmount}
            onChange={(e) => {
              const value = e.target.value;
              handleAmountChange(value === "" ? "" : Number(value));
            }}
            error={amountError}
            helperText={
              amountError
                ? "Minimum top up is $1.00 and maximum is $500.00."
                : `Top up ${formatUsdAmount(selectedPrice)}`
            }
            inputProps={{ min: MIN_TOP_UP_AMOUNT, max: 500, step: 0.01 }}
          />

          <Box
            sx={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 1.5,
              px: 2,
              py: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Current dollar balance
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {formatUsdAmount(user.balanceDollar || 0)}
            </Typography>
          </Box>

          {cardEnabled && (
            <Accordion>
              <AccordionSummary expandIcon={<i className="fas fa-chevron-down" />}>
                <Typography>{cardMethod.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {braintreeEnabled && clientToken && (
                  <Box ref={dropInContainerRef} sx={{ mb: 2 }} />
                )}
                {braintreeEnabled && !clientToken && (
                  <Typography variant="body2" sx={{ opacity: 0.75, mb: 2 }}>
                    Loading card form...
                  </Typography>
                )}
                {braintreeEnabled && (
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={
                      !dropInInstance ||
                      !isTopUpAmountValid ||
                      isProcessingPurchase
                    }
                    onClick={topUpWithBraintree}
                  >
                    {isProcessingPurchase ? "Processing..." : `Pay ${formatUsdAmount(selectedPrice)}`}
                  </Button>
                )}
                {!braintreeEnabled && stripeEnabled && (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    {cardMethod.provider?.unavailableMessage || cardMethod.subtitle}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          )}

          {cryptoEnabled && (
            <Accordion>
              <AccordionSummary expandIcon={<i className="fas fa-chevron-down" />}>
                <Typography>{cryptoMethod.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                  {cryptoCurrencies.length > 0 ? (
                    cryptoCurrencies.map((currency) => (
                      <Button
                        key={currency.code}
                        variant={nowPaymentsCurrency === currency.code ? "contained" : "outlined"}
                        onClick={() => generateCryptoTopUp(currency.code)}
                        disabled={
                          !isTopUpAmountValid ||
                          isProcessingPurchase ||
                          isBelowCryptoMinimumPaymentAmount(currency.code)
                        }
                        size="small"
                        startIcon={
                          currency.icon ? (
                            <i className={`fab fa-${currency.icon}`} />
                          ) : null
                        }
                      >
                        {currency.label}
                      </Button>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                      No crypto currencies are configured for this payment provider.
                    </Typography>
                  )}
                </Stack>
                {isCreatingCryptoPayment && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={18} />
                  </Box>
                )}
                {nowPaymentsPaymentId && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Payment ID: {nowPaymentsPaymentId}
                  </Typography>
                )}
                {nowPaymentsInvoiceUrl && (
                  <Button
                    onClick={() => window.open(nowPaymentsInvoiceUrl, "_blank", "noopener,noreferrer")}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  >
                    Open Invoice
                  </Button>
                )}
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  {nowPaymentsSuccessMessage
                    ? "Payment complete."
                    : nowPaymentsPaymentId
                    ? "Your balance will update automatically once the payment is confirmed."
                    : "Select a currency above to generate payment details."}
                </Typography>
                {nowPaymentsSuccessMessage && (
                  <Box
                    sx={{
                      alignItems: "center",
                      border: "1px solid",
                      borderColor: "success.main",
                      borderRadius: 1,
                      color: "success.main",
                      display: "flex",
                      gap: 1,
                      mt: 2,
                      p: 1.5,
                    }}
                  >
                    <i className="fas fa-check-circle" />
                    <Typography variant="body2">
                      {nowPaymentsSuccessMessage}
                    </Typography>
                  </Box>
                )}
                {nowPaymentsPaymentId &&
                  nowPaymentsStatus &&
                  !nowPaymentsSuccessMessage && (
                    <Typography
                      variant="caption"
                      sx={{ display: "block", mt: 1, opacity: 0.65 }}
                    >
                      Current status: {nowPaymentsStatus}
                    </Typography>
                  )}
                {!nowPaymentsPaymentId &&
                  cryptoMinimumPaymentAmounts.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          alignItems: "center",
                          display: "flex",
                          gap: 0.75,
                          opacity: 0.75,
                          mb: 0.75,
                        }}
                      >
                        <i className="fas fa-exclamation-triangle" />
                        Minimum payment amounts:
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 0.75,
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                        }}
                      >
                        {cryptoMinimumPaymentAmounts.map((amount) => (
                          <Typography
                            key={amount.currency}
                            variant="caption"
                            sx={{ opacity: 0.75 }}
                          >
                            {String(amount.currency).toUpperCase()} :{" "}
                            {formatUsdAmount(amount.fiatEquivalent)}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                {payAddress && payAmount && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Send exactly {payAmount}{" "}
                      {String(payCurrency || nowPaymentsCurrency).toUpperCase()} to:
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        textAlign: "center",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ mb: 1, overflowWrap: "anywhere" }}
                      >
                        {payAddress}
                      </Typography>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          payAddress
                        )}`}
                        alt="Payment address QR code"
                      />
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
