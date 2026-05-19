import React, { useState, useEffect, useContext } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Stack,
  Paper,
  Grid2,
} from "@mui/material";

import { Loading } from "../../components/Loading";

const formatUsdAmount = (amount) =>
  Number(amount || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function getItemCurrency(item = {}) {
  const currency = String(item.currency || "").trim().toLowerCase();
  if (["dollar", "dollars", "usd", "usdollar", "$"].includes(currency)) {
    return "dollar";
  }
  if (["coin", "coins"].includes(currency)) return "coins";
  return String(item.key || "").startsWith("emote-group-") ? "dollar" : "coins";
}

const isDollarBalanceItem = (item = {}) => getItemCurrency(item) === "dollar";

function formatItemPrice(item = {}) {
  return isDollarBalanceItem(item)
    ? formatUsdAmount(item.priceDollar ?? item.price)
    : `${item.price} coins`;
}

export default function EmoteShop() {
  const [shopInfo, setShopInfo] = useState({
    shopItems: [],
    emoteGroups: [],
    balance: 0,
    balanceDollar: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [emoteGroupToBuy, setEmoteGroupToBuy] = useState(null);
  const [buyStatus, setBuyStatus] = useState("idle");
  const [buyError, setBuyError] = useState("");

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Emote Shop | PassionMafia";
  }, []);

  useEffect(() => {
    if (user.loaded && user.loggedIn) {
      axios
        .get("/api/shop/emotes")
        .then((res) => {
          setShopInfo(res.data);
          setLoaded(true);
        })
        .catch(errorAlert);
    }
  }, [user.loaded]);

  const emoteGroups = shopInfo.emoteItems || shopInfo.emoteGroups || [];

  function closeBuyEmoteModal() {
    if (buyStatus === "buying") return;
    setEmoteGroupToBuy(null);
    setBuyStatus("idle");
    setBuyError("");
  }

  function onBuyItem(groupKey) {
    const group = emoteGroups.find((item) => item.key === groupKey);
    if (!group || !group.available) return;
    setEmoteGroupToBuy(group);
    setBuyStatus("idle");
    setBuyError("");
  }

  function confirmBuyEmoteGroup() {
    const group = emoteGroupToBuy;
    if (!group || buyStatus === "buying") return;
    setBuyStatus("buying");
    setBuyError("");
    axios
      .post("/api/shop/purchaseEmoteGroup", { key: group.key })
      .then((res) => {
        setShopInfo((prev) => {
          const updatedEmoteGroups = (prev.emoteItems || prev.emoteGroups || []).map((item) =>
            item.key === group.key ? { ...item, owned: true } : item
          );

          return {
            ...prev,
            balance: res.data.balance,
            balanceDollar: res.data.balanceDollar,
            emoteItems: updatedEmoteGroups,
            emoteGroups: updatedEmoteGroups,
          };
        });

        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          balanceDollar: res.data.balanceDollar,
          emoteGroupsOwned: Array.from(
            new Set([...(prev.emoteGroupsOwned || []), group.key])
          ),
        }));
        setBuyStatus("success");
        siteInfo.showAlert("Emote group purchased.", "success");
      })
      .catch((e) => {
        const message =
          e?.response?.data?.message ||
          (typeof e?.response?.data === "string" ? e.response.data : "") ||
          e?.message ||
          "Unable to buy emote group.";
        setBuyError(message);
        setBuyStatus("failed");
      });
  }

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack direction="column" spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="column" spacing={2} style={{ display: "block" }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h2">Chat Emotes</Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="h4" className="balance">
                {shopInfo.balance}
              </Typography>
              <Box
                component="i"
                className="fas fa-coins"
                aria-label="Coins"
                sx={{ fontSize: 24, color: "#f5c542" }}
              />
              <Typography variant="h4" className="balance">
                {formatUsdAmount(shopInfo.balanceDollar)}
              </Typography>
              <Box
                component="i"
                className="fas fa-wallet"
                aria-label="Dollar balance"
                sx={{ fontSize: 24, color: "success.main" }}
              />
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Buy emote groups to add every emote in that group to your chat emote list.
          </Typography>
          <Button variant="outlined" onClick={() => navigate("/shop")}>
            Back to Shop
          </Button>
        </Stack>
      </Paper>

      <Grid2 container spacing={2}>
        {emoteGroups.map((group) => {
          const iconSrc = group.iconUrl
            ? `${group.iconUrl}?t=${siteInfo.cacheVal || ""}`
            : "";
          return (
            <Grid2
              key={group.key}
              size={{
                xs: 12,
                sm: 6,
                md: 4,
              }}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  textAlign: "center",
                  flexDirection: "column",
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="column" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: "8px",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        backgroundImage: iconSrc ? `url(${iconSrc})` : "none",
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                    <Typography variant="body2" noWrap sx={{ width: "100%" }}>
                      {group.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ justifyContent: "center", minHeight: 34 }}
                    >
                      {(group.emotes || []).map((item) => (
                        <Box
                          key={item.id}
                          title={`:${item.name}:`}
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: "6px",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            backgroundImage: item.imageUrl
                              ? `url(${item.imageUrl}?t=${siteInfo.cacheVal || ""})`
                              : "none",
                            backgroundSize: "contain",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      ))}
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="h6">
                        {isDollarBalanceItem(group)
                          ? formatUsdAmount(group.priceDollar ?? group.price)
                          : group.price}
                      </Typography>
                      <Box
                        component="i"
                        className={
                          isDollarBalanceItem(group)
                            ? "fas fa-wallet"
                            : "fas fa-coins"
                        }
                        aria-label={
                          isDollarBalanceItem(group) ? "Dollar balance" : "Coins"
                        }
                        sx={{
                          fontSize: 16,
                          color: isDollarBalanceItem(group)
                            ? "success.main"
                            : "#f5c542",
                        }}
                      />
                    </Stack>
                  </Stack>

                  <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
                    {group.owned ? (
                      <Button variant="contained" disabled fullWidth>
                        Owned
                      </Button>
                    ) : !group.available ? (
                      <Button variant="contained" disabled fullWidth>
                        Unavailable
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => onBuyItem(group.key)}
                        fullWidth
                      >
                        Buy
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid2>
          );
        })}
      </Grid2>

      {emoteGroups.length === 0 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="column" spacing={2} alignItems="center">
            <Typography variant="h5">No emote groups available</Typography>
            <Typography variant="body2" color="text.secondary">
              Check back later for new chat emotes.
            </Typography>
          </Stack>
        </Paper>
      )}

      <Dialog
        open={Boolean(emoteGroupToBuy)}
        onClose={closeBuyEmoteModal}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Buy Emote Group</DialogTitle>
        <DialogContent dividers>
          {emoteGroupToBuy && (
            <Stack direction="column" spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    flex: "0 0 auto",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    backgroundImage: emoteGroupToBuy.iconUrl
                      ? `url(${emoteGroupToBuy.iconUrl}?t=${siteInfo.cacheVal || ""})`
                      : "none",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                    {emoteGroupToBuy.name || "Emote Group"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Adds every emote in this group to your chat emote list.
                  </Typography>
                </Box>
              </Stack>

              <Box
                sx={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 1.5,
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Price
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                    {formatItemPrice(emoteGroupToBuy)}
                  </Typography>
                  <Box
                    component="i"
                    className={
                      isDollarBalanceItem(emoteGroupToBuy)
                        ? "fas fa-wallet"
                        : "fas fa-coins"
                    }
                    aria-hidden="true"
                    sx={{
                      fontSize: 16,
                      color: isDollarBalanceItem(emoteGroupToBuy)
                        ? "success.main"
                        : "#f5c542",
                    }}
                  />
                </Stack>
              </Box>

              {buyStatus === "buying" && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Buying... purchase in progress.
                  </Typography>
                  <LinearProgress />
                </Box>
              )}

              {buyStatus === "success" && (
                <Alert severity="success">
                  Purchase complete. This emote group is now available in chat.
                </Alert>
              )}

              {buyStatus === "failed" && (
                <Alert severity="error">
                  Purchase failed. {buyError}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeBuyEmoteModal} disabled={buyStatus === "buying"}>
            {buyStatus === "success" || buyStatus === "failed" ? "Close" : "Cancel"}
          </Button>
          {buyStatus !== "success" && (
            <Button
              variant="contained"
              onClick={confirmBuyEmoteGroup}
              disabled={!emoteGroupToBuy || buyStatus === "buying"}
            >
              {buyStatus === "buying" ? "Buying..." : "Buy Emotes"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
