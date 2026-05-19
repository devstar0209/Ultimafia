import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  Alert,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Typography,
  Stack,
  Paper,
} from "@mui/material";

import { Loading } from "../../components/Loading";
import emoteShopHero from "../../images/shop/emotes-shop.webp";

const EMOTE_PAGE_SIZE = 4;

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

function withCache(url, cacheVal) {
  if (!url) return "";
  if (cacheVal == null) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${cacheVal}`;
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
        background: "rgba(5,12,17,0.72)",
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

function EmoteImage({ emote, cacheVal, size = 42 }) {
  const imageUrl = withCache(emote?.imageUrl, cacheVal);

  return (
    <Box
      title={emote?.name ? `:${emote.name}:` : ""}
      sx={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: 1.25,
        backgroundColor: "rgba(255,255,255,0.07)",
        backgroundImage: imageUrl ? `url("${imageUrl}")` : "none",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    />
  );
}

function GroupIcon({ group, cacheVal, size = 112 }) {
  const iconSrc = withCache(group?.iconUrl, cacheVal);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        mx: "auto",
        backgroundColor: "rgba(255,255,255,0.07)",
        backgroundImage: iconSrc ? `url("${iconSrc}")` : "none",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow:
          "0 22px 44px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    />
  );
}

function StatusChip({ group }) {
  if (group?.owned) {
    return (
      <Chip
        label="Owned"
        size="small"
        color="success"
        sx={{ fontWeight: 800 }}
      />
    );
  }

  if (!group?.available) {
    return <Chip label="Offline" size="small" color="default" />;
  }

  return (
    <Chip
      label="Live pack"
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

function PriceTag({ group, large = false }) {
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
        {isDollarBalanceItem(group)
          ? formatUsdAmount(group.priceDollar ?? group.price)
          : group.price}
      </Typography>
      <Box
        component="i"
        className={isDollarBalanceItem(group) ? "fas fa-wallet" : "fas fa-coins"}
        aria-label={isDollarBalanceItem(group) ? "Dollar balance" : "Coins"}
        sx={{
          fontSize: large ? 19 : 16,
          color: isDollarBalanceItem(group) ? "success.main" : "#f5c542",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
        }}
      />
    </Stack>
  );
}

function EmoteStrip({ emotes, cacheVal, limit = 8, size = 34, showOverflowCount = true }) {
  const visibleEmotes = (emotes || []).slice(0, limit);
  const hiddenCount = Math.max(0, Number((emotes || []).length) - visibleEmotes.length);

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {visibleEmotes.map((emote) => (
        <EmoteImage key={emote.id || emote.name} emote={emote} cacheVal={cacheVal} size={size} />
      ))}
      {showOverflowCount && hiddenCount > 0 && (
        <Stack
          sx={{
            width: size,
            height: size,
            borderRadius: 1.25,
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.72)",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          +{hiddenCount}
        </Stack>
      )}
    </Stack>
  );
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
  const [emotePage, setEmotePage] = useState(1);
  const [isEmotePageLoading, setIsEmotePageLoading] = useState(false);

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const errorAlertRef = useRef(errorAlert);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Emote Shop | PassionMafia";
  }, []);

  useEffect(() => {
    errorAlertRef.current = errorAlert;
  }, [errorAlert]);

  useEffect(() => {
    if (user.loaded && user.loggedIn) {
      setIsEmotePageLoading(true);
      axios
        .get("/api/shop/emotes", {
          params: {
            page: emotePage,
            pageSize: EMOTE_PAGE_SIZE,
          },
        })
        .then((res) => {
          setShopInfo(res.data);
          setLoaded(true);
        })
        .catch((e) => errorAlertRef.current(e))
        .finally(() => {
          setIsEmotePageLoading(false);
        });
    }
  }, [emotePage, user.loaded, user.loggedIn]);

  const emoteGroups = useMemo(
    () => shopInfo.emoteItems || shopInfo.emoteGroups || [],
    [shopInfo.emoteItems, shopInfo.emoteGroups]
  );
  const [filter, setFilter] = useState("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");

  const ownedCount = emoteGroups.filter((item) => item.owned).length;
  const liveCount = emoteGroups.filter((item) => item.available && !item.owned).length;
  const emotePagination = shopInfo.pagination || {
    page: emotePage,
    pageSize: EMOTE_PAGE_SIZE,
    total: emoteGroups.length,
    totalPages: 1,
  };
  const emoteTotalPages = Math.max(1, Number(emotePagination.totalPages || 1));

  const filteredGroups = useMemo(() => {
    if (filter === "owned") return emoteGroups.filter((item) => item.owned);
    if (filter === "live") {
      return emoteGroups.filter((item) => item.available && !item.owned);
    }
    return emoteGroups;
  }, [emoteGroups, filter]);

  const selectedGroup =
    filteredGroups.find((item) => item.key === selectedGroupKey) ||
    filteredGroups[0] ||
    emoteGroups.find((item) => item.key === selectedGroupKey) ||
    emoteGroups[0] ||
    null;

  useEffect(() => {
    if (!emoteGroups.length) {
      setSelectedGroupKey("");
      return;
    }

    setSelectedGroupKey((currentKey) =>
      emoteGroups.some((item) => item.key === currentKey)
        ? currentKey
        : emoteGroups[0].key
    );
  }, [emoteGroups]);

  useEffect(() => {
    setEmotePage(1);
  }, [filter]);

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
    <Stack direction="column" spacing={2.2} sx={{ pb: 2 }}>
      <Box
        sx={{
          minHeight: { xs: 270, md: 310 },
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.1)",
          background:
            "linear-gradient(135deg, rgba(15,25,28,0.98), rgba(35,21,37,0.94) 46%, rgba(8,12,17,0.98))",
          boxShadow: "0 26px 70px rgba(0,0,0,0.32)",
        }}
      >
        <Box
          component="img"
          src={emoteShopHero}
          alt=""
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: { xs: "100%", md: "52%" },
            objectFit: "cover",
            opacity: { xs: 0.28, md: 0.82 },
            maskImage:
              "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.62) 32%, #000 100%)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 18%, rgba(143,227,255,0.16), transparent 31%), radial-gradient(circle at 78% 72%, rgba(244,197,66,0.14), transparent 32%)",
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
              label={`${liveCount} live`}
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
              Emote Shop
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 1.2,
                color: "rgba(255,255,255,0.78)",
                maxWidth: 500,
                lineHeight: 1.5,
              }}
            >
              Modern chat packs for reactions, reads, and table talk across every
              game lobby.
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
              icon="fas fa-icons"
              label="Owned"
              value={`${ownedCount}/${emoteGroups.length}`}
              color="#8fe3ff"
            />
          </Stack>
        </Stack>
      </Box>

      {selectedGroup && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(270px, 370px) 1fr" },
            gap: 2,
            alignItems: "stretch",
          }}
        >
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(160deg, rgba(24,43,52,0.94), rgba(9,16,23,0.98))",
              p: 2,
              minHeight: 360,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 8%, rgba(143,227,255,0.14), transparent 36%)",
              }}
            />
            <Stack
              direction="column"
              spacing={2}
              sx={{ position: "relative", zIndex: 1, height: "100%" }}
            >
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <StatusChip group={selectedGroup} />
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.52)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Chat Pack
                </Typography>
              </Stack>

              <GroupIcon group={selectedGroup} cacheVal={siteInfo.cacheVal} size={132} />

              <Typography
                variant="h4"
                sx={{
                  color: "#fff",
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textAlign: "center",
                  overflowWrap: "anywhere",
                }}
              >
                {selectedGroup.name || "Emote Group"}
              </Typography>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

              <Stack direction="column" spacing={1.6} sx={{ mt: "auto" }}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <EmoteStrip
                    emotes={selectedGroup.emotes}
                    cacheVal={siteInfo.cacheVal}
                    limit={12}
                    size={32}
                  />
                </Box>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                    Price
                  </Typography>
                  <PriceTag group={selectedGroup} />
                </Stack>
                {selectedGroup.owned ? (
                  <Button variant="contained" disabled fullWidth>
                    Owned
                  </Button>
                ) : !selectedGroup.available ? (
                  <Button variant="outlined" disabled fullWidth>
                    Unavailable
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={() => onBuyItem(selectedGroup.key)}
                    fullWidth
                  >
                    Buy Emotes
                  </Button>
                )}
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
              <Typography variant="h3">Packs</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[
                  ["all", "All"],
                  ["live", "Live"],
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

            <Stack direction="column" spacing={1}>
              {filteredGroups.map((group) => {
                const isSelected = selectedGroup?.key === group.key;
                const disabled = !group.available && !group.owned;

                return (
                  <CardActionArea
                    key={group.key}
                    onClick={() => setSelectedGroupKey(group.key)}
                    sx={{
                      minHeight: { xs: 156, sm: 104 },
                      borderRadius: 1.5,
                      overflow: "hidden",
                      position: "relative",
                      p: { xs: 1.25, sm: 1.35 },
                      border: isSelected
                        ? "1px solid rgba(244,197,66,0.82)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: isSelected
                        ? "linear-gradient(150deg, rgba(74,58,28,0.84), rgba(17,27,34,0.98))"
                        : "linear-gradient(150deg, rgba(24,38,48,0.86), rgba(9,16,22,0.96))",
                      opacity: disabled ? 0.58 : 1,
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
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      sx={{
                        position: "relative",
                        zIndex: 1,
                        minHeight: "100%",
                        alignItems: { xs: "stretch", sm: "center" },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{
                          alignItems: "center",
                          minWidth: { xs: "100%", sm: 230 },
                          flex: "1 1 240px",
                        }}
                      >
                        <GroupIcon group={group} cacheVal={siteInfo.cacheVal} size={58} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ alignItems: "center", mb: 0.6 }}
                          >
                            <StatusChip group={group} />
                            {isSelected && (
                              <Box
                                component="i"
                                className="fas fa-crosshairs"
                                aria-hidden="true"
                                sx={{ color: "#f5c542", fontSize: 15 }}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "#fff",
                              fontWeight: 900,
                              lineHeight: 1.2,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {group.name || "Emote Group"}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack
                        direction={{ xs: "row", sm: "row" }}
                        spacing={1.25}
                        sx={{
                          alignItems: "center",
                          justifyContent: { xs: "space-between", sm: "flex-end" },
                          flex: "1 1 320px",
                        }}
                      >
                        <EmoteStrip
                          emotes={group.emotes}
                          cacheVal={siteInfo.cacheVal}
                          limit={4}
                          size={30}
                          showOverflowCount={false}
                        />
                        <PriceTag group={group} />
                      </Stack>
                    </Stack>
                  </CardActionArea>
                );
              })}
            </Stack>

            {filteredGroups.length === 0 && (
              <Paper sx={{ p: 3, mt: 1.5 }}>
                <Stack direction="column" spacing={2} alignItems="center">
                  <Typography variant="h5">No emote packs in this view</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Switch filters to browse the rest of the catalog.
                  </Typography>
                </Stack>
              </Paper>
            )}

            {emoteTotalPages > 1 && (
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
                  Page {emotePagination.page} / {emoteTotalPages}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  aria-label="Previous emote group page"
                  disabled={isEmotePageLoading || emotePage <= 1}
                  onClick={() => setEmotePage((page) => Math.max(1, page - 1))}
                  sx={{ minWidth: 38, width: 38, px: 0 }}
                >
                  <Box component="i" className="fas fa-caret-left" />
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  aria-label="Next emote group page"
                  disabled={isEmotePageLoading || emotePage >= emoteTotalPages}
                  onClick={() =>
                    setEmotePage((page) => Math.min(emoteTotalPages, page + 1))
                  }
                  sx={{ minWidth: 38, width: 38, px: 0 }}
                >
                  <Box component="i" className="fas fa-caret-right" />
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      )}

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
                      ? `url("${withCache(emoteGroupToBuy.iconUrl, siteInfo.cacheVal)}")`
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
