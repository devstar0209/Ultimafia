import React, { useState, useEffect, useContext } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  return String(item.key || "").startsWith("avatar-") ? "dollar" : "coins";
}

const isDollarBalanceItem = (item = {}) => getItemCurrency(item) === "dollar";

function formatItemPrice(item = {}) {
  return isDollarBalanceItem(item)
    ? formatUsdAmount(item.priceDollar ?? item.price)
    : `${item.price} coins`;
}

export default function AvatarShop() {
  const [shopInfo, setShopInfo] = useState({
    avatarItems: [],
    equippedAvatarKey: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [avatarToBuy, setAvatarToBuy] = useState(null);
  const [isBuyingAvatar, setIsBuyingAvatar] = useState(false);

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();

  useEffect(() => {
    document.title = "Avatar Shop | PassionMafia";
  }, []);

  useEffect(() => {
    if (user.loaded && user.loggedIn) {
      axios
        .get("/api/shop/avatars")
        .then((res) => {
          setShopInfo(res.data);
          setLoaded(true);
        })
        .catch(errorAlert);
    }
  }, [user.loaded]);

  function onEquipAvatar(avatarKey) {
    axios
      .post("/api/user/avatar/equip", { avatarKey })
      .then((res) => {
        const equippedAvatarKey = res.data.avatarKey || avatarKey;
        setShopInfo((prev) => ({
          ...prev,
          equippedAvatarKey,
          avatarItems: prev.avatarItems.map((item) => ({
            ...item,
            equipped: item.key === equippedAvatarKey,
          })),
        }));
        user.set((prev) => ({
          ...prev,
          avatar: res.data.avatar || prev.avatar,
          settings: {
            ...(prev.settings || {}),
            equippedAvatarKey,
          },
        }));
        siteInfo.clearCache();
        siteInfo.showAlert("Avatar equipped.", "success");
      })
      .catch(errorAlert);
  }

  function onBuyItem(avatarKey) {
    const avatar = shopInfo.avatarItems.find((item) => item.key === avatarKey);
    if (!avatar) return;
    setAvatarToBuy(avatar);
  }

  function closeBuyAvatarModal() {
    if (isBuyingAvatar) return;
    setAvatarToBuy(null);
  }

  function confirmBuyAvatar() {
    const avatar = avatarToBuy;
    if (!avatar) return;
    setIsBuyingAvatar(true);
    axios
      .post("/api/shop/purchase", { key: avatar.key })
      .then((res) => {
        siteInfo.showAlert("Avatar purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balance: res.data.balance,
          balanceDollar: res.data.balanceDollar,
          avatarItems: prev.avatarItems.map((item) =>
            item.key === avatar.key ? { ...item, owned: true } : item
          ),
        }));
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          balanceDollar: res.data.balanceDollar,
        }));

        // Auto-equip the newly purchased avatar
        return axios.post("/api/user/avatar/equip", { avatarKey: avatar.key });
      })
      .then((res) => {
        const equippedAvatarKey = res.data.avatarKey || avatar.key;
        setShopInfo((prev) => ({
          ...prev,
          equippedAvatarKey,
          avatarItems: prev.avatarItems.map((item) => ({
            ...item,
            equipped: item.key === equippedAvatarKey,
          })),
        }));
        user.set((prev) => ({
          ...prev,
          avatar: res.data.avatar || prev.avatar,
          settings: {
            ...(prev.settings || {}),
            equippedAvatarKey,
          },
        }));
        siteInfo.clearCache();
        siteInfo.showAlert("Avatar equipped.", "success");
        setAvatarToBuy(null);
      })
      .catch(errorAlert)
      .finally(() => {
        setIsBuyingAvatar(false);
      });
  }

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack direction="column" spacing={2}>
      <Grid2 container spacing={2}>
        {shopInfo.avatarItems.map((avatar) => {
          const equippedAvatarKey =
            shopInfo.equippedAvatarKey || user.settings?.equippedAvatarKey;
          const isEquipped = equippedAvatarKey === avatar.key;
          const isOwned = Boolean(avatar.owned);
          return (
            <Grid2
              key={avatar.key}
              size={{
                xs: 6,
                sm: 4,
                md: 2,
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
                  <Stack direction="column" spacing={2}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "8px",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        backgroundImage: avatar.imageUrl
                          ? `url("${avatar.imageUrl}")`
                          : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                    <Stack direction="column" spacing={1}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="h6">
                          {isDollarBalanceItem(avatar)
                            ? formatUsdAmount(avatar.priceDollar ?? avatar.price)
                            : avatar.price}
                        </Typography>
                        <Box
                          component="i"
                          className={
                            isDollarBalanceItem(avatar)
                              ? "fas fa-wallet"
                              : "fas fa-coins"
                          }
                          aria-label={
                            isDollarBalanceItem(avatar)
                              ? "Dollar balance"
                              : "Coins"
                          }
                          sx={{
                            fontSize: 16,
                            color: isDollarBalanceItem(avatar)
                              ? "success.main"
                              : "#f5c542",
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Stack>

                  <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
                    {isEquipped ? (
                      <Button
                        variant={isEquipped ? "contained" : "outlined"}
                        disabled={isEquipped}
                        onClick={() => onEquipAvatar(avatar.key)}
                        fullWidth
                      >
                        Equipped
                      </Button>
                    ) : isOwned ? (
                      <Button
                        variant="outlined"
                        onClick={() => onEquipAvatar(avatar.key)}
                        fullWidth
                      >
                        Equip
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => onBuyItem(avatar.key)}
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

      {shopInfo.avatarItems.length === 0 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="column" spacing={2} alignItems="center">
            <Typography variant="h5">No avatars available</Typography>
            <Typography variant="body2" color="text.secondary">
              Check back later for new profile avatars.
            </Typography>
          </Stack>
        </Paper>
      )}

      <Dialog
        open={Boolean(avatarToBuy)}
        onClose={closeBuyAvatarModal}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Buy Avatar</DialogTitle>
        <DialogContent dividers>
          {avatarToBuy && (
            <Stack direction="column" spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    flex: "0 0 auto",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    backgroundImage: avatarToBuy.imageUrl
                      ? `url("${avatarToBuy.imageUrl}")`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                    {avatarToBuy.name || "Avatar"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This avatar will be equipped after purchase.
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
                    {formatItemPrice(avatarToBuy)}
                  </Typography>
                  <Box
                    component="i"
                    className={
                      isDollarBalanceItem(avatarToBuy)
                        ? "fas fa-wallet"
                        : "fas fa-coins"
                    }
                    aria-hidden="true"
                    sx={{
                      fontSize: 16,
                      color: isDollarBalanceItem(avatarToBuy)
                        ? "success.main"
                        : "#f5c542",
                    }}
                  />
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeBuyAvatarModal} disabled={isBuyingAvatar}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmBuyAvatar}
            disabled={!avatarToBuy || isBuyingAvatar}
          >
            {isBuyingAvatar ? "Buying..." : "Buy Avatar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
