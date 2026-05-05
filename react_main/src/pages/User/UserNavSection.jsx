import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Avatar } from "./User";
import { useNow } from "../../hooks/useNow";
import { useIsPhoneDevice } from "../../hooks/useIsPhoneDevice";
import { useErrorAlert } from "../../components/Alerts";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Stack,
  Tooltip,
  Typography,
  Badge,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import NavDropdown from "../../components/NavDropdown";
import { SiteInfoContext } from "../../Contexts";

import "css/main.css";
import exitIcon from "../../images/emotes/exit.png";

const PAYMENT_PROVIDER_COPY = {
  braintree: {
    optionLabel: "Option 1",
    title: "Credit Card",
    subtitle: "Secure checkout powered by Braintree.",
  },
  nowpayments: {
    optionLabel: "Option 2",
    title: "Crypto Payment",
    subtitle: "Pay with USDT, USDC, ETH, or BTC via NowPayments.",
  },
};

export default function UserNavSection({
  openAnnouncements,
  user,
  useUnreadNotifications,
}) {
  const now = useNow(200);
  const navigate = useNavigate();
  const isMobile = useIsPhoneDevice();
  const unreadCount = useUnreadNotifications();
  const errorAlert = useErrorAlert();
  const [userFamily, setUserFamily] = useState(null);
  const siteInfo = useContext(SiteInfoContext);
  const { cacheVal } = siteInfo;
  const [buyCoinsDialogOpen, setBuyCoinsDialogOpen] = useState(false);
const [buyConfig, setBuyConfig] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState(50); 
  const [paymentProvider, setPaymentProvider] = useState("braintree");
  const [braintreeEnabled, setBraintreeEnabled] = useState(false);
  const [nowPaymentsEnabled, setNowPaymentsEnabled] = useState(false);
  const [nowPaymentsCurrencies, setNowPaymentsCurrencies] = useState([]);
  const [nowPaymentsCurrency, setNowPaymentsCurrency] = useState("");
  const [nowPaymentsPaymentId, setNowPaymentsPaymentId] = useState("");
  const [nowPaymentsInvoiceUrl, setNowPaymentsInvoiceUrl] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [dropInInstance, setDropInInstance] = useState(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const isMountedRef = useRef(false);
  const dropInContainerRef = useRef(null);
const selectedPrice = buyConfig ? (selectedAmount * buyConfig.pricePerCoin).toFixed(2) : '0.00';

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (user.loggedIn) {
      axios
        .get("/api/family/user/family")
        .then((res) => {
          if (cancelled || !isMountedRef.current) return;
          setUserFamily(res.data.family);
        })
        .catch(() => {
          // Ignore errors, user might not have a family
        });
    }

    return () => {
      cancelled = true;
    };
  }, [user.loggedIn]);

  const handleLogout = () => {
    axios
      .post("/api/user/logout")
      .then(() => {
        user.clear();
        navigate("/");
        window.location.reload();
      })
      .catch((error) => {
        console.error("Logout failed:", error);
      });
  };

  // Use vanity URL for profile link if available
  const profilePath = user.vanityUrl ? `/user/${user.vanityUrl}` : "/user";

  // Create family avatar icon if family exists and has avatar
  const familyIcon = userFamily?.avatar ? (
    <div
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundImage: `url(/uploads/${userFamily.id}_family_avatar.webp?t=${cacheVal})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        flexShrink: 0,
      }}
    />
  ) : null;

  const userMenuItems = [
    {
      text: "Profile",
      path: profilePath,
      icon: (<i className="fas fa-user"/>),
    },
    ...(userFamily
      ? [
          {
            text: userFamily.name,
            path: `/user/family/${userFamily.id}`,
            icon: familyIcon,
          },
        ]
      : []),
    {
      text: "Inbox",
      path: "/user/inbox",
      icon: (
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <i className="fas fa-inbox"/>
        </Badge>
      ),
    },
    {
      text: "Settings",
      path: "/user/settings",
      icon: (<i className="fas fa-cog"/>),
    },
    {
      text: "Announcements",
      onClick: openAnnouncements,
      icon: (<i className="fas fa-bullhorn"/>),
    },
    { divider: true },
    {
      text: "Log Out",
      onClick: handleLogout,
      icon: (
        <img
          src={exitIcon}
          alt="exit"
          style={{ width: "16px", height: "16px" }}
        />
      ),
    },
  ];

  function closeBuyCoinsDialog() {
    setBuyCoinsDialogOpen(false);
    setBuyConfig(null);
    setSelectedAmount(50);
    setPaymentProvider("braintree");
    setBraintreeEnabled(false);
    setNowPaymentsEnabled(false);
    setNowPaymentsCurrencies([]);
    setNowPaymentsCurrency("");
    setNowPaymentsPaymentId("");
    setNowPaymentsInvoiceUrl("");
    setClientToken("");
    setDropInInstance(null);
    setIsProcessingPurchase(false);
  }

  const loadBraintreeToken = useCallback(() => {
    return axios
      .get("/api/shop/buyCoins/token")
      .then((res) => {
        if (!isMountedRef.current) return;
        setClientToken(res.data.clientToken);
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      });
  }, [errorAlert]);

  const loadBuyConfig = useCallback(() => {
    return axios
      .get("/api/shop/buyCoins/config")
      .then((res) => {
        if (!isMountedRef.current) return;
        setBuyConfig(res.data);
      })
      .catch((e) => {
        if (isMountedRef.current) console.error("Unable to load buy config", e);
      });
  }, []);

function openBuyCoinsDialog() {
  // don't change here
    setBuyCoinsDialogOpen(true);
  }

  const handleAmountChange = (newAmount) => {
    setSelectedAmount(newAmount);
    setNowPaymentsPaymentId("");
    setNowPaymentsInvoiceUrl("");
  };

  function handlePaymentProviderChange(nextProvider) {
    setPaymentProvider(nextProvider);
  }

  const [payAddress, setPayAddress] = useState("");
  const [payAmount, setPayAmount] = useState("");
  function generateCryptoPayment(currencyCode) {
    setNowPaymentsCurrency(currencyCode);
    setNowPaymentsPaymentId("");
    setNowPaymentsInvoiceUrl("");
    setPayAddress("");
    setPayAmount("");
    setIsProcessingPurchase(true);
    axios.post("/api/shop/buyCoins/nowpayments/createInvoice", {
      amount: selectedAmount,
      payCurrency: currencyCode,
    }).then((res) => {
      if (!isMountedRef.current) return;
      setNowPaymentsPaymentId(res.data.paymentId || "");
      setNowPaymentsInvoiceUrl(res.data.invoiceUrl || "");
      setPayAddress(res.data.payAddress || "");
      setPayAmount(res.data.payAmount || "");
      setIsProcessingPurchase(false);
      if (res.data.invoiceUrl) {
        window.open(res.data.invoiceUrl, "_blank", "noopener,noreferrer");
      }
    }).catch((e) => {
      if (isMountedRef.current) errorAlert(e);
    }).finally(() => {
      if (isMountedRef.current) setIsProcessingPurchase(false);
    });
  }

  function buyCoinsWithBraintree() {
    if (!dropInInstance || !selectedAmount) return;
    setIsProcessingPurchase(true);
    dropInInstance
      .requestPaymentMethod()
      .then((payload) =>
        axios.post("/api/shop/buyCoins/checkout", {
          amount: selectedAmount,
          paymentMethodNonce: payload.nonce,
        })
      )
      .then((res) => {
        if (!isMountedRef.current) return;
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
        }));
        if (res.data.alreadyCredited) {
          siteInfo.showAlert("This payment was already credited.", "basic");
        } else {
          siteInfo.showAlert(
            `Purchased ${res.data.coinsAdded} coins successfully.`,
            "success"
          );
        }
        closeBuyCoinsDialog();
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  }

  function createNowPaymentsInvoice() {
    if (!selectedAmount || !nowPaymentsCurrency) return;
    setIsProcessingPurchase(true);
    axios
      .post("/api/shop/buyCoins/nowpayments/createInvoice", {
        amount: selectedAmount,
        payCurrency: nowPaymentsCurrency,
      })
      .then((res) => {
        if (!isMountedRef.current) return;
        setNowPaymentsPaymentId(res.data.paymentId || "");
        setNowPaymentsInvoiceUrl(res.data.invoiceUrl || "");

        if (res.data.invoiceUrl) {
          window.open(res.data.invoiceUrl, "_blank", "noopener,noreferrer");
        } else {
          siteInfo.showAlert(
            `Invoice created. Payment ID: ${res.data.paymentId}`,
            "basic"
          );
        }
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  }

  function claimNowPaymentsInvoice() {
    if (!nowPaymentsPaymentId) return;
    setIsProcessingPurchase(true);
    axios
      .post("/api/shop/buyCoins/nowpayments/claim", {
        paymentId: nowPaymentsPaymentId,
      })
      .then((res) => {
        if (!isMountedRef.current) return;
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
        }));
        siteInfo.showAlert(
          `Purchased ${res.data.coinsAdded} coins successfully.`,
          "success"
        );
        closeBuyCoinsDialog();
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        const waitingMessage = err?.response?.data?.message;
        if (waitingMessage) {
          siteInfo.showAlert(waitingMessage, "basic");
          return;
        }
        errorAlert(err);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  }

  useEffect(() => {
    if (
      buyCoinsDialogOpen &&
      paymentProvider === "braintree" &&
      braintreeEnabled &&
      !clientToken
    ) {
      loadBraintreeToken();
    }
  }, [
    buyCoinsDialogOpen,
    paymentProvider,
    braintreeEnabled,
    clientToken,
    loadBraintreeToken,
  ]);

  useEffect(() => {
    if (buyCoinsDialogOpen && !buyConfig) {
      loadBuyConfig();
    }
  }, [buyCoinsDialogOpen, buyConfig, loadBuyConfig]);

  useEffect(() => {
    if (
      !buyCoinsDialogOpen ||
      paymentProvider !== "braintree" ||
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
  }, [buyCoinsDialogOpen, clientToken, paymentProvider]);

  function timeToGo(timestamp) {
    // Utility to add leading zero
    function z(n) {
      return (n < 10 ? "0" : "") + n;
    }

    var diff = timestamp - now;
    if (diff < 0) diff = 0;

    // Get time components
    var hours = (diff / 3.6e6) | 0;
    var mins = ((diff % 3.6e6) / 6e4) | 0;
    var secs = Math.round((diff % 6e4) / 1e3);

    // Return formatted string
    return z(hours) + ":" + z(mins) + ":" + z(secs);
  }

  function getHeartRefreshMessage(user, type) {
    var timestamp = null;

    if (type === "red") timestamp = user.redHeartRefreshTimestamp;
    else if (type === "gold") timestamp = user.goldHeartRefreshTimestamp;

    if (timestamp && timestamp > 0) {
      const timeToGoString = timeToGo(timestamp);
      //console.log(type, timestamp, timeToGoString, user)
      return `Your ${type} hearts will replenish in: ${timeToGoString}`;
    } else {
      return `Your ${type} hearts are at full capacity. Go play some games!`;
    }
  }

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        divider={<Divider orientation="vertical" flexItem />}
        sx={{
          px: 1,
          alignItems: "center",
          justifyContent: "end",
        }}
      >
        <Button
          onClick={openBuyCoinsDialog}
          size="small"
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.25,
          }}
        >
          {isMobile ? "Buy" : "Buy Coins"}
        </Button>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <Typography variant="body2">
            {(Number(user.coins) || 0).toLocaleString()}
          </Typography>
          <Box
            component="i"
            className="fas fa-coins"
            aria-label="Coins"
            sx={{ fontSize: 18, color: "#f5c542" }}
          />
        </Stack>
        <Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1em",
              columnGap: 0.5,
              width: "3em",
              alignItems: "center",
              textAlign: "right",
            }}
          >
            <Typography variant="body2">
              {user.redHearts ?? 0}
            </Typography>
            <Tooltip title={getHeartRefreshMessage(user, "red")}>
              <i
                className="fas fa-heart"
                style={{ color: "#e23b3b", marginLeft: "auto" }}
              />
            </Tooltip>
            <Typography variant="body2">
              {user.goldHearts ?? 0}
            </Typography>
            <Link to="/fame/competitive">
              <i
                className="fas fa-heart"
                style={{ color: "var(--gold-heart-color)", marginLeft: "auto" }}
              />
            </Link>
          </Box>
        </Stack>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NavDropdown
            items={userMenuItems}
            customTrigger={<Avatar id={user.id} name={user.name} hasImage={user.avatar} />}
          />
        </Badge>
      </Stack>
      <Dialog
        open={buyCoinsDialogOpen}
        onClose={closeBuyCoinsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Buy Coins</DialogTitle>
        <DialogContent dividers>
          <Stack direction="column" spacing={2}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {[10, 50, 100, 300].map((amt) => (
                <Button
                  key={amt}
                  variant={selectedAmount === amt ? 'contained' : 'outlined'}
                  onClick={() => handleAmountChange(amt)}
                  size="small"
                >
                  {amt} coins
                </Button>
              ))}
              </Stack>
            <TextField
              fullWidth
              label="Custom amount"
              type="number"
              value={selectedAmount}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              inputProps={{
                min: buyConfig?.minAmount || 50,
                max: buyConfig?.maxAmount || 5000,
                step: 50
              }}
              helperText={`$${selectedPrice} (${buyConfig?.pricePerCoin ? (1/buyConfig.pricePerCoin).toFixed(0) : '10'} coins/$)`}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              {braintreeEnabled && (
                <Button
                  fullWidth
                  variant={paymentProvider === "braintree" ? "contained" : "outlined"}
                  onClick={() => handlePaymentProviderChange("braintree")}
                  sx={{
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    minHeight: 110,
                    px: 2,
                    py: 1.5,
                    textAlign: "left",
                    textTransform: "none",
                  }}
                >
                  <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                    <Typography variant="overline" sx={{ lineHeight: 1.2 }}>
                      {PAYMENT_PROVIDER_COPY.braintree.optionLabel}
                    </Typography>
                    <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                      {PAYMENT_PROVIDER_COPY.braintree.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        opacity: paymentProvider === "braintree" ? 0.9 : 0.75,
                      }}
                    >
                      {PAYMENT_PROVIDER_COPY.braintree.subtitle}
                    </Typography>
                  </Stack>
                </Button>
              )}
              {nowPaymentsEnabled && (
                <Button
                  fullWidth
                  variant={paymentProvider === "nowpayments" ? "contained" : "outlined"}
                  onClick={() => handlePaymentProviderChange("nowpayments")}
                  sx={{
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    minHeight: 110,
                    px: 2,
                    py: 1.5,
                    textAlign: "left",
                    textTransform: "none",
                  }}
                >
                  <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                    <Typography variant="overline" sx={{ lineHeight: 1.2 }}>
                      {PAYMENT_PROVIDER_COPY.nowpayments.optionLabel}
                    </Typography>
                    <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                      {PAYMENT_PROVIDER_COPY.nowpayments.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        opacity: paymentProvider === "nowpayments" ? 0.9 : 0.75,
                      }}
                    >
                      {PAYMENT_PROVIDER_COPY.nowpayments.subtitle}
                    </Typography>
                  </Stack>
                </Button>
              )}
            </Stack>

            {buyConfig && (
              <Box
                sx={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 1.5,
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Selected amount
                </Typography>
                <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                  {selectedAmount} coins
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  ${selectedPrice}
                </Typography>
              </Box>
            )}

  <Accordion>
    <AccordionSummary expandIcon={<i className="fas fa-chevron-down"/>}>
      <Typography>Pay with Credit Card</Typography>
    </AccordionSummary>
    <AccordionDetails>
      {clientToken ? (
        <Box ref={dropInContainerRef} sx={{ mb: 2 }} />
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.75, mb: 2 }}>
          Loading card form...
        </Typography>
      )}
      <Button
        fullWidth
        variant="contained"
        disabled={!dropInInstance || isProcessingPurchase}
        onClick={buyCoinsWithBraintree}
      >
        {isProcessingPurchase ? "Processing..." : "Pay $" + selectedPrice}
      </Button>
    </AccordionDetails>
  </Accordion>

  <Accordion>
    <AccordionSummary expandIcon={<i className="fas fa-chevron-down"/>}>
      <Typography>Pay with Crypto</Typography>
    </AccordionSummary>
    <AccordionDetails>
  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
        {[
          { code: 'usdttrc20', label: 'USDT', icon: 'usdt' },
          { code: 'usdc', label: 'USDC', icon: 'usdc' },
          { code: 'btc', label: 'BTC', icon: 'btc' },
          { code: 'eth', label: 'ETH', icon: 'eth' },
        ].map((currency) => (
          <Button
            key={currency.code}
            variant={nowPaymentsCurrency === currency.code ? "contained" : "outlined"}
            onClick={() => generateCryptoPayment(currency.code)}
            size="small"
            startIcon={<i className={`fab fa-${currency.icon}`} />}
          >
            {currency.label}
          </Button>
        ))}
      </Stack>
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
      {nowPaymentsPaymentId ? (
        <Button
          fullWidth
          variant="contained"
          onClick={claimNowPaymentsInvoice}
          disabled={isProcessingPurchase}
        >
          {isProcessingPurchase ? "Processing..." : "Claim Payment"}
        </Button>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Select currency above to generate QR code and address.
        </Typography>
      )}
      {nowPaymentsPaymentId && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Payment ID: {nowPaymentsPaymentId}
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => window.open(nowPaymentsInvoiceUrl, "_blank", "noopener,noreferrer")}
          >
            Open Invoice
          </Button>
        </Box>
      )}
      {payAddress && payAmount && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Send exactly {payAmount} {nowPaymentsCurrency.toUpperCase()} to:
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>{payAddress}</Typography>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${payAddress}`} alt="QR Code" />
          </Box>
        </Box>
      )}
    </AccordionDetails>
  </Accordion>
          </Stack>
        </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeBuyCoinsDialog}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
