import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { Loading } from "../../components/Loading";
import avatarShopHero from "../../images/shop/avatars-shop.webp";

const AVATAR_PAGE_SIZE = 8;

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

function withCache(url, cacheVal) {
  if (!url) return "";
  if (cacheVal == null) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${cacheVal}`;
}

function isSoldOut(item = {}) {
  if (item.limit == null || item.limit === "") return false;
  return Number(item.holderCnt || 0) >= Number(item.limit);
}

function getStockLabel(item = {}) {
  if (item.limit == null || item.limit === "") return "∞";
  return `${Number(item.holderCnt || 0)}/${Number(item.limit)}`;
}

function StockLabel({ avatar, compact = false }) {
  const unlimited = avatar?.limit == null || avatar?.limit === "";

  if (unlimited) {
    return (
      <Typography
        component="span"
        sx={{
          color: "rgba(255,255,255,0.86)",
          fontSize: compact ? 24 : 28,
          fontWeight: 900,
          lineHeight: 0.75,
        }}
      >
        ∞
      </Typography>
    );
  }

  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ color: "rgba(255,255,255,0.84)", fontWeight: 700 }}
    >
      {getStockLabel(avatar)}
    </Typography>
  );
}

function getStockPercent(item = {}) {
  if (item.limit == null || item.limit === "") return 100;
  const limit = Math.max(1, Number(item.limit || 1));
  return Math.min(100, Math.max(0, (Number(item.holderCnt || 0) / limit) * 100));
}

function WalletPill({ icon, label, value, color }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        px: 1.35,
        py: 0.85,
        borderRadius: 1,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(6,13,18,0.72)",
        minWidth: { xs: "auto", sm: 132 },
      }}
    >
      <Box
        component="i"
        className={icon}
        aria-hidden="true"
        sx={{ color, fontSize: 16 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.62)",
            display: "block",
            lineHeight: 1,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "#fff", fontWeight: 800, lineHeight: 1.35 }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function AvatarImage({ avatar, cacheVal, size = 120 }) {
  const imageUrl = withCache(avatar?.imageUrl, cacheVal);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        mx: "auto",
        display: "block",
        flex: "0 0 auto",
        backgroundColor: "rgba(255,255,255,0.06)",
        backgroundImage: imageUrl ? `url("${imageUrl}")` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow:
          "0 22px 44px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    />
  );
}

function StatusChip({ avatar, isEquipped, isOwned }) {
  if (isEquipped) {
    return (
      <Chip
        label="Equipped"
        size="small"
        color="success"
        sx={{ fontWeight: 800 }}
      />
    );
  }

  if (isOwned) {
    return (
      <Chip
        label="Owned"
        size="small"
        sx={{
          color: "#8fe3ff",
          borderColor: "rgba(143,227,255,0.45)",
          backgroundColor: "rgba(29,137,184,0.16)",
          fontWeight: 800,
        }}
      />
    );
  }

  if (!avatar.available) {
    return <Chip label="Offline" size="small" color="default" />;
  }

  if (isSoldOut(avatar)) {
    return <Chip label="Sold out" size="small" color="error" />;
  }

  return (
    <Chip
      label="Live drop"
      size="small"
      sx={{
        color: "#ffe08a",
        borderColor: "rgba(255,224,138,0.48)",
        backgroundColor: "rgba(185,125,28,0.16)",
        fontWeight: 800,
      }}
    />
  );
}

function StockMeter({ avatar }) {
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.75 }}
      >
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
          Supply
        </Typography>
        <StockLabel avatar={avatar} />
      </Stack>
      <Box
        sx={{
          height: 7,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${getStockPercent(avatar)}%`,
            background:
              avatar.limit == null
                ? "linear-gradient(90deg, #36d399, #46b2ff)"
                : "linear-gradient(90deg, #f4c542, #ef7d4d)",
          }}
        />
      </Box>
    </Box>
  );
}

function PriceTag({ avatar, large = false }) {
  return (
    <Stack
      direction="row"
      spacing={0.85}
      sx={{
        alignItems: "center",
        justifyContent: large ? "flex-start" : "center",
      }}
    >
      <Typography
        variant={large ? "h4" : "h6"}
        sx={{ fontWeight: 900, lineHeight: 1.1 }}
      >
        {isDollarBalanceItem(avatar)
          ? formatUsdAmount(avatar.priceDollar ?? avatar.price)
          : avatar.price}
      </Typography>
      <Box
        component="i"
        className={isDollarBalanceItem(avatar) ? "fas fa-wallet" : "fas fa-coins"}
        aria-label={isDollarBalanceItem(avatar) ? "Dollar balance" : "Coins"}
        sx={{
          fontSize: large ? 19 : 16,
          color: isDollarBalanceItem(avatar) ? "success.main" : "#f5c542",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
        }}
      />
    </Stack>
  );
}

export default function AvatarShop() {
  const [shopInfo, setShopInfo] = useState({
    avatarItems: [],
    equippedAvatarKey: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [avatarToBuy, setAvatarToBuy] = useState(null);
  const [isBuyingAvatar, setIsBuyingAvatar] = useState(false);
  const [selectedAvatarKey, setSelectedAvatarKey] = useState("");
  const [filter, setFilter] = useState("all");
  const [avatarPage, setAvatarPage] = useState(1);
  const [isAvatarPageLoading, setIsAvatarPageLoading] = useState(false);

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const errorAlertRef = useRef(errorAlert);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Avatar Shop | PassionMafia";
  }, []);

  useEffect(() => {
    errorAlertRef.current = errorAlert;
  }, [errorAlert]);

  useEffect(() => {
    if (user.loaded && user.loggedIn) {
      setIsAvatarPageLoading(true);
      axios
        .get("/api/shop/avatars", {
          params: {
            page: avatarPage,
            pageSize: AVATAR_PAGE_SIZE,
          },
        })
        .then((res) => {
          const avatars = res.data.avatarItems || [];
          const equippedAvatarKey = res.data.equippedAvatarKey;
          const initialSelection =
            avatars.find((item) => item.key === equippedAvatarKey)?.key ||
            avatars.find((item) => item.available && !item.owned && !isSoldOut(item))
              ?.key ||
              avatars[0]?.key ||
            "";

          setShopInfo(res.data);
          setSelectedAvatarKey((currentKey) =>
            avatars.some((item) => item.key === currentKey)
              ? currentKey
              : initialSelection
          );
          setLoaded(true);
        })
        .catch((e) => errorAlertRef.current(e))
        .finally(() => {
          setIsAvatarPageLoading(false);
        });
    }
  }, [avatarPage, user.loaded, user.loggedIn]);

  const equippedAvatarKey =
    shopInfo.equippedAvatarKey || user.settings?.equippedAvatarKey || "";
  const avatarItems = useMemo(
    () => shopInfo.avatarItems || [],
    [shopInfo.avatarItems]
  );
  const ownedCount = avatarItems.filter((item) => item.owned).length;
  const availableCount = avatarItems.filter(
    (item) => item.available && !item.owned && !isSoldOut(item)
  ).length;

  const filteredAvatars = useMemo(() => {
    if (filter === "owned") return avatarItems.filter((item) => item.owned);
    if (filter === "available") {
      return avatarItems.filter(
        (item) => item.available && !item.owned && !isSoldOut(item)
      );
    }
    return avatarItems;
  }, [avatarItems, filter]);

  const selectedAvatar =
    avatarItems.find((item) => item.key === selectedAvatarKey) ||
    filteredAvatars[0] ||
    avatarItems[0] ||
    null;
  const avatarPagination = shopInfo.pagination || {
    page: avatarPage,
    pageSize: AVATAR_PAGE_SIZE,
    total: avatarItems.length,
    totalPages: 1,
  };
  const avatarTotalPages = Math.max(1, Number(avatarPagination.totalPages || 1));

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
      .post("/api/shop/purchaseAvatar", { key: avatar.key })
      .then((res) => {
        siteInfo.showAlert("Avatar purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balance: res.data.balance,
          balanceDollar: res.data.balanceDollar,
          avatarItems: prev.avatarItems.map((item) =>
            item.key === avatar.key
              ? {
                  ...item,
                  owned: true,
                  holderCnt: res.data.holderCnt ?? Number(item.holderCnt || 0) + 1,
                }
              : item
          ),
        }));
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          balanceDollar: res.data.balanceDollar,
          avatarsOwned: Array.from(
            new Set([...(prev.avatarsOwned || []), avatar.key])
          ),
        }));

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

  function getPrimaryAction(avatar) {
    if (!avatar) return null;
    const isEquipped = equippedAvatarKey === avatar.key;
    const isOwned = Boolean(avatar.owned);

    if (isEquipped) {
      return (
        <Button variant="contained" disabled fullWidth>
          Equipped
        </Button>
      );
    }

    if (isOwned) {
      return (
        <Button variant="contained" onClick={() => onEquipAvatar(avatar.key)} fullWidth>
          Equip Avatar
        </Button>
      );
    }

    if (!avatar.available) {
      return (
        <Button variant="outlined" disabled fullWidth>
          Unavailable
        </Button>
      );
    }

    if (isSoldOut(avatar)) {
      return (
        <Button variant="outlined" disabled fullWidth>
          Sold Out
        </Button>
      );
    }

    return (
      <Button variant="contained" onClick={() => onBuyItem(avatar.key)} fullWidth>
        Buy Avatar
      </Button>
    );
  }

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack direction="column" spacing={2.2} sx={{ pb: 2 }}>
      <Box
        sx={{
          minHeight: { xs: 270, md: 310 },
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.1)",
          background:
            "linear-gradient(135deg, rgba(14,25,31,0.98), rgba(30,19,44,0.94) 48%, rgba(7,11,16,0.98))",
          boxShadow: "0 26px 70px rgba(0,0,0,0.32)",
        }}
      >
        <Box
          component="img"
          src={avatarShopHero}
          alt=""
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: { xs: "100%", md: "52%" },
            objectFit: "cover",
            opacity: { xs: 0.34, md: 0.88 },
            maskImage:
              "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 32%, #000 100%)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 19% 18%, rgba(83,211,197,0.18), transparent 31%), radial-gradient(circle at 77% 70%, rgba(244,197,66,0.16), transparent 32%)",
          }}
        />
        <Stack
          direction="column"
          spacing={2.2}
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: { xs: 270, md: 310 },
            justifyContent: "space-between",
            p: { xs: 2, md: 3 },
            maxWidth: { xs: "100%", md: "58%" },
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate("/shop")}
              startIcon={<Box component="i" className="fas fa-chevron-left" />}
              sx={{
                borderColor: "rgba(255,255,255,0.22)",
                color: "rgba(255,255,255,0.92)",
                backgroundColor: "rgba(0,0,0,0.18)",
              }}
            >
              Shop
            </Button>
            <Chip
              label={`${availableCount} live`}
              size="small"
              sx={{
                color: "#ffe08a",
                backgroundColor: "rgba(185,125,28,0.18)",
                border: "1px solid rgba(255,224,138,0.32)",
                fontWeight: 800,
              }}
            />
          </Stack>

          <Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: 34, md: 48 },
                lineHeight: 1,
                letterSpacing: 0,
                color: "#fff",
                textTransform: "uppercase",
              }}
            >
              Avatar Shop
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 1.2,
                color: "rgba(255,255,255,0.78)",
                maxWidth: 470,
                lineHeight: 1.5,
              }}
            >
              Limited profile avatars, instant equip, and fresh drops for your
              player identity.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <WalletPill
              icon="fas fa-coins"
              label="Coins"
              value={Number(shopInfo.balance ?? user.coins ?? 0).toLocaleString()}
              color="#f5c542"
            />
            <WalletPill
              icon="fas fa-wallet"
              label="Wallet"
              value={formatUsdAmount(shopInfo.balanceDollar ?? user.balanceDollar)}
              color="#36d399"
            />
            <WalletPill
              icon="fas fa-user-astronaut"
              label="Owned"
              value={`${ownedCount}/${avatarItems.length}`}
              color="#8fe3ff"
            />
          </Stack>
        </Stack>
      </Box>

      {selectedAvatar && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 360px) 1fr" },
            gap: 2,
            alignItems: "stretch",
          }}
        >
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(160deg, rgba(25,43,57,0.94), rgba(9,16,23,0.98))",
              p: 2,
              minHeight: 330,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 8%, rgba(54,211,153,0.14), transparent 36%)",
              }}
            />
            <Stack
              direction="column"
              spacing={2}
              sx={{ position: "relative", zIndex: 1, height: "100%" }}
            >
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <StatusChip
                  avatar={selectedAvatar}
                  isEquipped={equippedAvatarKey === selectedAvatar.key}
                  isOwned={Boolean(selectedAvatar.owned)}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.52)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Profile Skin
                </Typography>
              </Stack>

              <AvatarImage avatar={selectedAvatar} cacheVal={siteInfo.cacheVal} size={148} />

              <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

              <Stack direction="column" spacing={1.6} sx={{ mt: "auto" }}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                    Price
                  </Typography>
                  <PriceTag avatar={selectedAvatar} />
                </Stack>
                <StockMeter avatar={selectedAvatar} />
                {getPrimaryAction(selectedAvatar)}
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(7,13,19,0.62)",
              p: { xs: 1.25, md: 1.5 },
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                mb: 1.5,
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Typography variant="h3">Drops</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[
                  ["all", "All"],
                  ["available", "Live"],
                  ["owned", "Owned"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    variant={filter === value ? "contained" : "outlined"}
                    size="small"
                    onClick={() => setFilter(value)}
                    sx={{ minWidth: 78 }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(3, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1.25,
              }}
            >
              {filteredAvatars.map((avatar) => {
                const isSelected = selectedAvatar?.key === avatar.key;
                const isEquipped = equippedAvatarKey === avatar.key;
                const isOwned = Boolean(avatar.owned);
                const disabled = !avatar.available || isSoldOut(avatar);

                return (
                  <CardActionArea
                    key={avatar.key}
                    onClick={() => setSelectedAvatarKey(avatar.key)}
                    sx={{
                      minHeight: 214,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      position: "relative",
                      p: 1.25,
                      border: isSelected
                        ? "1px solid rgba(244,197,66,0.82)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: isSelected
                        ? "linear-gradient(150deg, rgba(74,58,28,0.84), rgba(17,27,34,0.98))"
                        : "linear-gradient(150deg, rgba(24,38,48,0.86), rgba(9,16,22,0.96))",
                      opacity: disabled && !isOwned ? 0.58 : 1,
                      boxShadow: isSelected
                        ? "0 18px 46px rgba(244,197,66,0.16)"
                        : "0 16px 36px rgba(0,0,0,0.24)",
                      transition:
                        "transform 160ms ease, border-color 160ms ease, background 160ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: isSelected
                          ? "rgba(244,197,66,0.9)"
                          : "rgba(143,227,255,0.44)",
                      },
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at 50% 22%, rgba(143,227,255,0.09), transparent 38%)",
                        pointerEvents: "none",
                      },
                    }}
                  >
                    <Stack
                      direction="column"
                      spacing={1}
                      sx={{
                        position: "relative",
                        zIndex: 1,
                        height: "100%",
                        alignItems: "center",
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{ alignItems: "center", justifyContent: "space-between" }}
                      >
                        <StatusChip
                          avatar={avatar}
                          isEquipped={isEquipped}
                          isOwned={isOwned}
                        />
                        {isSelected && (
                          <Box
                            component="i"
                            className="fas fa-crosshairs"
                            aria-hidden="true"
                            sx={{ color: "#f5c542", fontSize: 15 }}
                          />
                        )}
                      </Stack>
                      <AvatarImage avatar={avatar} cacheVal={siteInfo.cacheVal} size={86} />
                      <PriceTag avatar={avatar} />
                      <Typography
                        sx={{
                          color: "rgba(255,255,255,0.68)",
                          fontWeight: 700,
                          lineHeight: 1.2,
                          textAlign: "center",
                        }}
                      >
                        <StockLabel avatar={avatar} compact />
                      </Typography>
                    </Stack>
                  </CardActionArea>
                );
              })}
            </Box>

            {filteredAvatars.length === 0 && (
              <Paper sx={{ p: 3, mt: 1.5 }}>
                <Stack direction="column" spacing={2} alignItems="center">
                  <Typography variant="h5">No avatars in this view</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Switch filters to browse the rest of the catalog.
                  </Typography>
                </Stack>
              </Paper>
            )}

            {avatarTotalPages > 1 && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  justifyContent: "flex-end",
                  alignItems: "center",
                  mt: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.62)", fontWeight: 700 }}
                >
                  Page {avatarPagination.page} / {avatarTotalPages}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  aria-label="Previous avatar page"
                  disabled={isAvatarPageLoading || avatarPage <= 1}
                  onClick={() => setAvatarPage((page) => Math.max(1, page - 1))}
                  sx={{ minWidth: 38, width: 38, px: 0 }}
                >
                  <Box component="i" className="fas fa-chevron-left" />
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  aria-label="Next avatar page"
                  disabled={isAvatarPageLoading || avatarPage >= avatarTotalPages}
                  onClick={() =>
                    setAvatarPage((page) => Math.min(avatarTotalPages, page + 1))
                  }
                  sx={{ minWidth: 38, width: 38, px: 0 }}
                >
                  <Box component="i" className="fas fa-chevron-right" />
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      )}

      {avatarItems.length === 0 && (
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
                <AvatarImage avatar={avatarToBuy} cacheVal={siteInfo.cacheVal} size={72} />
                <Box sx={{ minWidth: 0 }}>
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
            disabled={!avatarToBuy || isBuyingAvatar || isSoldOut(avatarToBuy)}
          >
            {isBuyingAvatar ? "Buying..." : "Buy Avatar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
