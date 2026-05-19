import React, { useState, useEffect, useContext } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import update from "immutability-helper";

import { useErrorAlert } from "../../components/Alerts";
import { UserContext, SiteInfoContext } from "../../Contexts";

import {
  Box,
  Button,
  Typography,
  CardContent,
  TextField,
  Stack,
  Paper,
  CardActionArea,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  IconButton,
} from "@mui/material";

import { Loading } from "../../components/Loading";
import avatarShopHero from "../../images/shop/avatars-shop.webp";
import emoteShopHero from "../../images/shop/emotes-shop.webp";

import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";

function parseGameId(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/game\/([^/?\s]+)/);
  if (match) return match[1];
  // If no URL pattern, treat the whole input as a raw game ID (no slashes/spaces)
  if (/^[^\s/]+$/.test(trimmed)) return trimmed;
  return "";
}

const formatUsdAmount = (amount) =>
  Number(amount || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


const isDollarBalanceItem = (item = {}) => item.currency === "dollar";

function formatItemPrice(item = {}) {
  return isDollarBalanceItem(item)
    ? formatUsdAmount(item.price)
    : `${item.price} coins`;
}

function ShopItemIcon({ item, cacheVal }) {
  if (!item.imageUrl) return null;

  const imageSrc =
    cacheVal == null
      ? item.imageUrl
      : `${item.imageUrl}${item.imageUrl.includes("?") ? "&" : "?"}t=${cacheVal}`;

  return (
    <Box
      component="img"
      src={imageSrc}
      alt=""
      aria-hidden="true"
      sx={{
        width: 100,
        height: 75,
        mx: "auto",
        display: "block",
      }}
    />
  );
}

function FeaturePanel({ variant, title, description, buttonText, onClick }) {
  const isAvatars = variant === "avatars";
  const panelImage = isAvatars ? avatarShopHero : emoteShopHero;
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      sx={{
        height: { xs: 238, md: 270 },
        borderRadius: 2,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        border: `1px solid ${isAvatars ? "rgba(166,108,255,0.42)" : "rgba(38,231,225,0.38)"}`,
        background: isAvatars
          ? "linear-gradient(135deg, #1a0f2d 0%, #130b21 55%, #090d14 100%)"
          : "linear-gradient(135deg, #061f29 0%, #062b33 50%, #071018 100%)",
        boxShadow: "0 26px 70px rgba(0,0,0,0.34)",
        transition: "transform 160ms ease, border-color 160ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: isAvatars ? "#a66cff" : "#26e7e1",
        },
      }}
    >
      <Box
        component="img"
        src={panelImage}
        alt=""
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: isAvatars ? 0 : "auto",
          right: isAvatars ? "auto" : 0,
          zIndex: 0,
          width: { xs: "100%", sm: "58%" },
          height: "100%",
        }}
      />
      <Stack
        spacing={2}
        sx={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: { xs: 0, sm: isAvatars ? "auto" : "30px" },
          pl: {xs: 5, sm: 0},
          right: { xs: 0, sm: isAvatars ? "30px" : "auto" },
          zIndex: 1,
          width: "auto",
        }}
      >
        <Typography variant="h2" sx={{ fontSize: { xs: 25, md: 28 } }}>
          {title.toUpperCase()}
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.78)", maxWidth: 260 }}>
          {description}
        </Typography>
        <Button
          component="span"
          endIcon={<Box component="i" className="fas fa-chevron-right" />}
          sx={{
            alignSelf: "flex-start",
            minWidth: 192,
            py: 1.2,
            borderRadius: 0.5,
            color: "#ffffff",
            background: isAvatars
              ? "linear-gradient(135deg, #8d2de2, #4720a4)"
              : "linear-gradient(135deg, #079b9d, #026f75)",
            border: "1px solid rgba(255,255,255,0.14)",
            "&:hover": {
              background: isAvatars
                ? "linear-gradient(135deg, #9f46f0, #5630b6)"
                : "linear-gradient(135deg, #0cb9b9, #087f86)",
            },
          }}
        >
          {buttonText}
        </Button>
      </Stack>
    </Box>
  );
}

export default function Shop() {
  const [shopInfo, setShopInfo] = useState({
    shopItems: []
  });
  const [loaded, setLoaded] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [stampGameUrl, setStampGameUrl] = useState("");
  const [stampDialogOpen, setStampDialogOpen] = useState(false);
  const [stampSuggestions, setStampSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const isPhoneDevice = useIsPhoneDevice();
  const location = useLocation();
  const navigate = useNavigate();
  const [autoBuyTriggered, setAutoBuyTriggered] = useState(false);

  useEffect(() => {
    document.title = "Shop | PassionMafia";
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

  useEffect(() => {
    if (!loaded || autoBuyTriggered) return;
    const params = new URLSearchParams(location.search);
    const buyKey = params.get("buy");
    if (!buyKey) return;
    const index = shopInfo.shopItems.findIndex((item) => item.key === buyKey);
    if (index < 0) return;
    const item = shopInfo.shopItems[index];
    const numOwned = user.itemsOwned[item.key] || 0;
    if (item.disabled || numOwned === item.limit) return;
    setAutoBuyTriggered(true);
    onBuyItem(index);
  }, [loaded, location.search]);



  const handleTransferCoins = () => {
    if (!recipient || !amount) {
      siteInfo.showAlert("Please fill out all fields.", "error");
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      siteInfo.showAlert(
        "Please enter a valid positive integer amount.",
        "error"
      );
      return;
    }

    axios
      .post("/api/shop/transferCoins", {
        recipientUsername: recipient,
        amount: parsedAmount,
      })
      .then(() => {
        siteInfo.showAlert("Coins transferred.", "success");
        setRecipient("");
        setAmount("");
      })
      .catch((err) => {
        errorAlert(err);
      });
  };

  function onBuyItem(index) {
    const item = shopInfo.shopItems[index];
    const itemPrice = formatItemPrice(item);
    const shouldBuy = window.confirm(
      `Are you sure you wish to buy ${item.name} for ${itemPrice}?`
    );

    if (!shouldBuy) return;

    axios
      .post("/api/shop/purchaseShopItem", { key: item.key, item: item.shopIndex ?? index })
      .then((res) => {
        siteInfo.showAlert("Item purchased.", "success");

        setShopInfo((prev) => ({
          ...prev
        }));

        let itemsOwnedChanges = {
          [item.key]: {
            $set: Number(user.itemsOwned?.[item.key] || 0) + 1,
          },
        };

        for (let k in item.propagateItemUpdates || {}) {
          let change = item.propagateItemUpdates[k];
          itemsOwnedChanges[k] = {
            $set: Number(user.itemsOwned?.[k] || 0) + change,
          };
        }
        const userUpdate = {
          itemsOwned: itemsOwnedChanges,
          coins: { $set: res.data.balance },
          balanceDollar: { $set: res.data.balanceDollar },
        };
        user.set(update(user.state, userUpdate));
      })
      .catch(errorAlert);
  }

  const shopItems = shopInfo.shopItems.map((item, i) => {
    const numOwned = user.itemsOwned[item.key] || 0;
    const disabled = item.disabled || numOwned === item.limit;

    const price = (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
          {isDollarBalanceItem(item)
            ? formatUsdAmount(item.priceDollar ?? item.price)
            : item.price}
        </Typography>
        <Box
          component="i"
          className={isDollarBalanceItem(item) ? "fas fa-wallet" : "fas fa-coins"}
          aria-label={isDollarBalanceItem(item) ? "Dollar balance" : "Coins"}
          sx={{
            fontSize: 19,
            color: isDollarBalanceItem(item) ? "success.main" : "#f5c542",
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
          }}
        />
      </Stack>
    );

    return (
      <Box key={item.key || i}>
        <CardActionArea
          disabled={disabled}
          onClick={() => {
            if (item.key === "stamp") {
              setStampDialogOpen(true);
              setShowSuggestions(true);
              axios.get("/api/shop/stampSuggestions")
                .then((res) => setStampSuggestions(res.data))
                .catch(() => setStampSuggestions([]));
            } else {
              onBuyItem(i);
            }
          }}
          sx={{
            height: "100%",
            width: "100%",
            minHeight: 220,
            borderRadius: 2,
            opacity: disabled ? 0.48 : 1,
            border: "1px solid rgba(117, 160, 184, 0.32)",
            background:
              "linear-gradient(150deg, rgba(25, 43, 57, 0.88), rgba(12, 27, 34, 0.96))",
            boxShadow: "0 20px 48px rgba(0,0,0,0.28)",
            overflow: "hidden",
            position: "relative",
            transition:
              "transform 160ms ease, border-color 160ms ease, background 160ms ease",
            "&:hover": {
              transform: disabled ? undefined : "translateY(-2px)",
              borderColor: disabled ? undefined : "rgba(95,209,199,0.58)",
              background:
                "linear-gradient(150deg, rgba(31, 52, 68, 0.96), rgba(12, 31, 39, 0.98))",
            },
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 52% 38%, rgba(95,209,199,0.09), transparent 38%)",
              pointerEvents: "none",
            },
          }}
        >
          <CardContent
            sx={{
              position: "relative",
              zIndex: 1,
              height: "100%",
              width: "100%",
              p: 2.1,
            }}
          >
            <Stack
              direction="column"
              spacing={1.15}
              sx={{
                height: "100%",
                width: "100%",
                minHeight: 188,
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  minHeight: 34,
                  lineHeight: 1.2,
                  color: "rgba(255,255,255,0.95)",
                  overflowWrap: "anywhere",
                }}
              >
                {item.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "rgba(255,255,255,0.76)", fontSize: 13 }}
              >
                Owned: {numOwned}
                {item.limit != null && ` / ${item.limit}`}
              </Typography>
              {item.imageUrl && (
                <Box>
                  <ShopItemIcon item={item} cacheVal={siteInfo.cacheVal} />
                </Box>
              )}
              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.35,
                  flex: 1,
                }}
              >
                {item.desc}
              </Typography>
              <Box sx={{ pt: 0.25 }}>{price}</Box>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Box>
    );
  });

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack
      direction="column"
      spacing={2}
      sx={{
        pb: 2,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <FeaturePanel
          variant="avatars"
          title="Buy Avatars"
          description="Purchase and equip profile avatars to stand out."
          buttonText="Browse Avatars"
          onClick={() => navigate("/shop/avatars")}
        />
        <FeaturePanel
          variant="emotes"
          title="Buy Emoticons"
          description="Shop for emoticons to use in chat during games."
          buttonText="Browse Emoticons"
          onClick={() => navigate("/shop/emotes")}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {shopItems}
      </Box>
      <Dialog
        open={stampDialogOpen}
        onClose={() => {
          setStampDialogOpen(false);
          setStampGameUrl("");
          setSelectedSuggestion(null);
          setStampSuggestions([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Buy Scrapbook Stamp</DialogTitle>
        <DialogContent sx={{ overflow: "visible" }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter the URL or ID of a Mafia game you won. You will receive a
            stamp of the role you played.
          </Typography>
          <Box sx={{ position: "relative" }}>
            <TextField
              autoFocus
              fullWidth
              label="Game URL or ID"
              value={stampGameUrl}
              onChange={(e) => {
                setStampGameUrl(e.target.value);
                setSelectedSuggestion(null);
                setShowSuggestions(false);
              }}
              placeholder="e.g. https://PassionMafia.io/game/abc123 or abc123"
              InputProps={stampSuggestions.length > 0 ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowSuggestions((v) => !v)}
                    >
                      <i
                        className={`fas fa-chevron-${showSuggestions ? "up" : "down"}`}
                        style={{ fontSize: "12px" }}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              } : undefined}
            />
            {showSuggestions && stampSuggestions.length > 0 && (
              <Paper
                sx={{
                  position: "absolute",
                  zIndex: 1301,
                  left: 0,
                  right: 0,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {stampSuggestions.map((s) => (
                  <Box
                    key={s.gameId}
                    sx={{
                      px: 2,
                      py: 1,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setStampGameUrl(s.gameId);
                      setSelectedSuggestion(s);
                      setShowSuggestions(false);
                    }}
                  >
                    <Typography variant="body2">
                      {s.gameId} - {s.role}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}
          </Box>
          {selectedSuggestion && (
            <Typography
              variant="caption"
              sx={{ mt: 1, display: "block" }}
              color="success.main"
            >
              Stamp role: {selectedSuggestion.role}
            </Typography>
          )}
          {!selectedSuggestion && stampGameUrl.trim() && (
            <Typography
              variant="caption"
              sx={{ mt: 1, display: "block" }}
              color={parseGameId(stampGameUrl) ? "textSecondary" : "error"}
            >
              {parseGameId(stampGameUrl)
                ? `Game ID: ${parseGameId(stampGameUrl)}`
                : "Could not parse a game ID from this input."}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setStampDialogOpen(false);
              setStampGameUrl("");
              setSelectedSuggestion(null);
              setStampSuggestions([]);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!parseGameId(stampGameUrl)}
            onClick={() => {
              const gameId = parseGameId(stampGameUrl);
              if (!gameId) {
                siteInfo.showAlert("Could not parse a game ID.", "error");
                return;
              }
              const stampIndex = shopInfo.shopItems.findIndex((si) => si.key === "stamp");
              const stampItem = shopInfo.shopItems[stampIndex];
              axios
                .post("/api/shop/checkStampEligibility", { gameId })
                .then((eligibility) => {
                  const shouldBuy = window.confirm(
                    `You will receive a stamp for ${eligibility.data.role}. Purchase for ${formatItemPrice(stampItem)}?`
                  );
                  if (!shouldBuy) return;
                  return axios.post("/api/shop/purchaseShopItem", {
                    key: stampItem.key,
                    item: stampItem.shopIndex ?? stampIndex,
                    gameId: eligibility.data.gameId,
                  });
                })
                .then((res) => {
                  if (!res) return;
                  siteInfo.showAlert(
                    `Stamp purchased: ${res.data.role}!`,
                    "success"
                  );
                  setStampGameUrl("");
                  setSelectedSuggestion(null);
                  setStampSuggestions([]);
                  setStampDialogOpen(false);
                  setShopInfo((prev) => ({
                    ...prev,
                    balance: res.data.balance,
                    balanceDollar: res.data.balanceDollar,
                  }));
                  user.set((prev) => ({
                    ...prev,
                    coins: res.data.balance,
                    balanceDollar: res.data.balanceDollar,
                  }));
                })
                .catch(errorAlert);
            }}
          >
            Check Eligibility
          </Button>
        </DialogActions>
      </Dialog>

      <Divider flexItem orientation="horizontal" />

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={isPhoneDevice ? "column" : "row"}
          spacing={1}
          sx={{
            alignItems: isPhoneDevice ? "stretch" : "center",
            width: "100%",
          }}
        >
          <Typography variant="h3">Transfer coins</Typography>
          <Divider
            flexItem
            orientation={isPhoneDevice ? "horizontal" : "vertical"}
          />
          <TextField
            label="Recipient Username"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            sx={{
              flex: "1",
            }}
          />
          <TextField
            label="Amount to Transfer"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{
              flex: "1",
            }}
          />
          <Button
            onClick={handleTransferCoins}
            sx={{
              alignSelf: "stretch",
            }}
          >
            Transfer
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
