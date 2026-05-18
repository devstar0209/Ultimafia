import React, { useState, useEffect, useContext } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Stack,
  Paper,
  Grid2,
} from "@mui/material";

import { Loading } from "../../components/Loading";

import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";

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

export default function AvatarShop(props) {
  const [shopInfo, setShopInfo] = useState({
    avatarItems: [],
    equippedAvatarKey: "",
  });
  const [loaded, setLoaded] = useState(false);

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const isPhoneDevice = useIsPhoneDevice();
  const navigate = useNavigate();

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
        setShopInfo((prev) => ({
          ...prev,
          equippedAvatarKey: res.data.avatarKey || avatarKey,
        }));
        siteInfo.showAlert("Avatar equipped.", "success");
      })
      .catch(errorAlert);
  }

  function onBuyItem(avatarKey) {
    const avatar = shopInfo.avatarItems.find((item) => item.key === avatarKey);
    if (!avatar) return;

    const shouldBuy = window.confirm(
      `Are you sure you wish to buy ${avatar.name} for ${formatItemPrice(avatar)}?`
    );

    if (!shouldBuy) return;

    axios
      .post("/api/shop/purchase", { key: avatar.key })
      .then((res) => {
        siteInfo.showAlert("Avatar purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balance: res.data.balance,
          balanceDollar: res.data.balanceDollar,
          avatarItems: prev.avatarItems.map((item) =>
            item.key === avatarKey ? { ...item, owned: true } : item
          ),
        }));
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          balanceDollar: res.data.balanceDollar,
        }));

        // Auto-equip the newly purchased avatar
        return axios.post("/api/user/avatar/equip", { avatarKey });
      })
      .then((res) => {
        setShopInfo((prev) => ({
          ...prev,
          equippedAvatarKey: res.data.avatarKey || avatarKey,
        }));
        siteInfo.showAlert("Avatar equipped.", "success");
      })
      .catch(errorAlert);
  }

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack direction="column" spacing={2}>
      <Grid2 container spacing={2}>
        {shopInfo.avatarItems.map((avatar) => {
          const isEquipped = user.settings.equippedAvatarKey === avatar.key;
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
    </Stack>
  );
}
