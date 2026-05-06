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

export default function AvatarShop(props) {
  const [shopInfo, setShopInfo] = useState({
    shopItems: [],
    avatarItems: [],
    equippedAvatarKey: "",
    balance: 0,
    balanceDollar: 0,
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
        .get("/api/shop/info")
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
      `Are you sure you wish to buy ${avatar.name} for ${formatUsdAmount(
        avatar.priceDollar
      )}?`
    );

    if (!shouldBuy) return;

    axios
      .post("/api/shop/spendCoins", { item: shopInfo.shopItems.findIndex((item) => item.key === avatarKey) })
      .then((res) => {
        siteInfo.showAlert("Avatar purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balanceDollar: res.data.balanceDollar,
          avatarItems: prev.avatarItems.map((item) =>
            item.key === avatarKey ? { ...item, owned: true } : item
          ),
        }));
        user.set((prev) => ({
          ...prev,
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
      <Paper sx={{ p: 2 }}>
        <Stack direction="column" spacing={2} style={{"display": "block"}}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h2">Profile Avatars</Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
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
            Buy and equip profile avatars to customize your appearance.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/user/shop")}
          >
            Back to Shop
          </Button>
        </Stack>
      </Paper>

      <Grid2 container spacing={2}>
        {shopInfo.avatarItems.map((avatar) => {
          const isEquipped = shopInfo.equippedAvatarKey === avatar.key;
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
                        backgroundImage: avatar.available
                          ? `url(${avatar.imageUrl}?t=${siteInfo.cacheVal})`
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
                          {formatUsdAmount(avatar.priceDollar)}
                        </Typography>
                        <Box
                          component="i"
                          className="fas fa-wallet"
                          aria-label="Dollar balance"
                          sx={{ fontSize: 16, color: "success.main" }}
                        />
                      </Stack>
                    </Stack>
                  </Stack>

                  <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
                    {avatar.owned ? (
                      <Button
                        variant={isEquipped ? "contained" : "outlined"}
                        disabled={isEquipped}
                        onClick={() => onEquipAvatar(avatar.key)}
                        fullWidth
                      >
                        {isEquipped ? "Equipped" : "Equip"}
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
