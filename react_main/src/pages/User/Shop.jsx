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
  Card,
  CardContent,
  TextField,
  Stack,
  Paper,
  Grid2,
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

const isDollarBalanceItem = (item = {}) =>
  String(item.key || "").startsWith("avatar-");

export default function Shop(props) {
  const [shopInfo, setShopInfo] = useState({
    shopItems: [],
    avatarItems: [],
    equippedAvatarKey: "",
    balance: 0,
    balanceDollar: 0,
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
    const usesDollarBalance = isDollarBalanceItem(item);
    const itemPrice = usesDollarBalance
      ? formatUsdAmount(item.priceDollar)
      : `${item.price} coins`;
    const shouldBuy = window.confirm(
      `Are you sure you wish to buy ${item.name} for ${itemPrice}?`
    );

    if (!shouldBuy) return;

    axios
      .post("/api/shop/spendCoins", { item: index })
      .then((res) => {
        siteInfo.showAlert("Item purchased.", "success");

        setShopInfo((prev) => ({
          ...prev,
          balance: res.data.balance,
          balanceDollar: res.data.balanceDollar,
        }));

        let itemsOwnedChanges = {
          [item.key]: {
            $set: user.itemsOwned[item.key] + 1,
          },
        };

        for (let k in item.propagateItemUpdates) {
          let change = item.propagateItemUpdates[k];
          itemsOwnedChanges[k] = {
            $set: user.itemsOwned[k] + change,
          };
        }

        const nextOwnedCount = (user.itemsOwned[item.key] || 0) + 1;
        const userUpdate = {
          itemsOwned: itemsOwnedChanges,
        };
        if (usesDollarBalance) {
          userUpdate.balanceDollar = { $set: res.data.balanceDollar };
        } else {
          userUpdate.coins = { $set: res.data.balance };
        }
        user.set(update(user.state, userUpdate));

        if (item.key.startsWith("avatar-") && nextOwnedCount > 0) {
          return axios.post("/api/user/avatar/equip", { avatarKey: item.key });
        }
      })
      .then((equipRes) => {
        if (!equipRes) return;
        setShopInfo((prev) => ({
          ...prev,
          equippedAvatarKey: equipRes.data.avatarKey || prev.equippedAvatarKey,
          avatarItems: prev.avatarItems.map((avatar) =>
            avatar.key === equipRes.data.avatarKey
              ? { ...avatar, owned: true }
              : avatar
          ),
        }));
        siteInfo.showAlert("Avatar equipped.", "success");
      })
      .catch(errorAlert);
  }

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
        <Typography>
          {isDollarBalanceItem(item)
            ? formatUsdAmount(item.priceDollar)
            : item.price}
        </Typography>
        <Box
          component="i"
          className={isDollarBalanceItem(item) ? "fas fa-wallet" : "fas fa-coins"}
          aria-label={isDollarBalanceItem(item) ? "Dollar balance" : "Coins"}
          sx={{
            fontSize: 20,
            color: isDollarBalanceItem(item) ? "success.main" : "#f5c542",
          }}
        />
      </Stack>
    );

    return (
      <Grid2
        size={{
          xs: 12,
          sm: 6,
          md: 3,
        }}
        key={i}
      >
        <Card
          variant="outlined"
          sx={{
            height: "100%",
            width: "100%",
            opacity: disabled ? "50%" : undefined,
            minHeight: isPhoneDevice ? undefined : "15em",
          }}
        >
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
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                width: "100%",
              }}
            >
              <Stack
                direction={isPhoneDevice ? "row" : "column"}
                spacing={1}
                sx={{
                  height: "100%",
                  width: "100%",
                }}
              >
                <Stack
                  direction="column"
                  spacing={1}
                  sx={{
                    height: "100%",
                    flex: "1",
                    marginBottom: isPhoneDevice ? undefined : 1,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="h3"
                      sx={{ flex: isPhoneDevice ? "1" : undefined }}
                    >
                      {item.name}
                    </Typography>
                    {isPhoneDevice && price}
                  </Stack>
                  <Typography variant="caption">
                    Owned: {user.itemsOwned[item.key] || 0}
                    {item.limit != null && ` / ${item.limit}`}
                  </Typography>
                  <Paper
                    sx={{
                      p: 1,
                      flex: isPhoneDevice ? undefined : "1",
                    }}
                  >
                    <Typography variant="body2">{item.desc}</Typography>
                  </Paper>
                </Stack>
                {!isPhoneDevice && <Box sx={{ pt: 1 }}>{price}</Box>}
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid2>
    );
  });

  if (user.loaded && !user.loggedIn) return <Navigate to="/play" />;

  if (!loaded) return <Loading small />;

  return (
    <Stack direction="column" spacing={1}>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "center",
          }}
        >
          <Typography variant="h3" className="balance">
            You have: {shopInfo.balance}
          </Typography>
          <Box
            component="i"
            className="fas fa-coins"
            aria-label="Coins"
            sx={{ fontSize: 20, color: "#f5c542" }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "center",
            mt: 1,
          }}
        >
          <Typography variant="h3" className="balance">
            Dollar balance: {formatUsdAmount(shopInfo.balanceDollar)}
          </Typography>
          <Box
            component="i"
            className="fas fa-wallet"
            aria-label="Dollar balance"
            sx={{ fontSize: 20, color: "success.main" }}
          />
        </Stack>
      </Paper>

      <Grid2 container spacing={1}>
        <Grid2
          size={{
            xs: 12,
            sm: 6,
          }}
        >
          <Card
            variant="outlined"
            sx={{
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s ease",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "primary.main",
              },
            }}
          >
            <CardActionArea
              onClick={() => navigate("/user/shop/avatars")}
              sx={{ height: "100%" }}
            >
              <CardContent>
                <Stack direction="column" spacing={1} alignItems="center">
                  <Typography variant="h3">Buy Avatars</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Purchase and equip profile avatars
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid2>
        <Grid2
          size={{
            xs: 12,
            sm: 6,
          }}
        >
          <Card
            variant="outlined"
            sx={{
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s ease",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "primary.main",
              },
            }}
          >
            <CardActionArea
              onClick={() => navigate("/user/shop")}
              sx={{ height: "100%" }}
            >
              <CardContent>
                <Stack direction="column" spacing={1} alignItems="center">
                  <Typography variant="h3">Buy Emoticons</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Shop for emoticons to use in the chat during games
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid2>
      </Grid2>



      <Grid2 container spacing={1}>
        {shopItems}
      </Grid2>
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
                      {s.gameId} — {s.role}
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
                    `You will receive a stamp for ${eligibility.data.role}. Purchase for ${stampItem.price} coins?`
                  );
                  if (!shouldBuy) return;
                  return axios.post("/api/shop/spendCoins", {
                    item: stampIndex,
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
                  }));
                  user.set((prev) => ({
                    ...prev,
                    coins: res.data.balance,
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
