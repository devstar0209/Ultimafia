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

export default function EmoteShop() {
  const [shopInfo, setShopInfo] = useState({
    shopItems: [],
    emoteGroups: [],
    balance: 0,
  });
  const [loaded, setLoaded] = useState(false);

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
        .get("/api/shop/info")
        .then((res) => {
          setShopInfo(res.data);
          setLoaded(true);
        })
        .catch(errorAlert);
    }
  }, [user.loaded]);

  const emoteGroups = shopInfo.emoteGroups || shopInfo.emoteItems || [];

  function onBuyItem(groupKey) {
    const group = emoteGroups.find((item) => item.key === groupKey);
    if (!group || !group.available) return;

    const shouldBuy = window.confirm(
      `Are you sure you wish to buy ${group.name} for ${group.price} coins?`
    );

    if (!shouldBuy) return;

    axios
      .post("/api/shop/purchase", { item: group.shopIndex })
      .then((res) => {
        siteInfo.showAlert("Emote group purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balance: res.data.balance,
          emoteGroups: (prev.emoteGroups || prev.emoteItems || []).map((item) =>
            item.key === groupKey ? { ...item, owned: true } : item
          ),
        }));

        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          itemsOwned: {
            ...(prev.itemsOwned || {}),
            [groupKey]: Number(prev.itemsOwned?.[groupKey] || 0) + 1,
          },
          settings: {
            ...(prev.settings || {}),
            customEmotes: {
              ...(prev.settings?.customEmotes || {}),
              ...(res.data.customEmote || {}),
            },
          },
        }));
      })
      .catch(errorAlert);
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
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Buy emote groups to add every emote in that group to your chat emote list.
          </Typography>
          <Button variant="outlined" onClick={() => navigate("/user/shop")}>
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
                      <Typography variant="h6">{group.price}</Typography>
                      <Box
                        component="i"
                        className="fas fa-coins"
                        aria-label="Coins"
                        sx={{ fontSize: 16, color: "#f5c542" }}
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
    </Stack>
  );
}
