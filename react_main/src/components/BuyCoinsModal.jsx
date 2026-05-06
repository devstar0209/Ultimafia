import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { SiteInfoContext } from "Contexts";
import { useErrorAlert } from "components/Alerts";

const MIN_COIN_PURCHASE_AMOUNT = 200;

const formatUsdAmount = (amount) => {
  const number = Number(amount);
  if (!Number.isFinite(number)) return "";

  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function BuyCoinsModal({ open, onClose, user }) {
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const [buyConfig, setBuyConfig] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState("");
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const isMountedRef = useRef(false);

  const presetAmounts = [200, 300, 500, 1000];
  const selectedAmountNumber = Number(selectedAmount);
  const hasSelectedAmount = selectedAmount !== "";
  const isCoinAmountValid =
    hasSelectedAmount &&
    Number.isInteger(selectedAmountNumber) &&
    selectedAmountNumber >= MIN_COIN_PURCHASE_AMOUNT;
  const amountError = hasSelectedAmount && !isCoinAmountValid;
  const selectedPrice = buyConfig
    ? (
        Number.isFinite(selectedAmountNumber)
          ? selectedAmountNumber * buyConfig.pricePerCoin
          : 0
      ).toFixed(2)
    : "0.00";
  const selectedPriceNumber = Number(selectedPrice);
  const balanceDollar = Number(user.balanceDollar || 0);
  const hasEnoughBalance =
    isCoinAmountValid && balanceDollar >= selectedPriceNumber;
  const priceHelperText = buyConfig
    ? `${formatUsdAmount(selectedPrice)} (${buyConfig.coinsPerDollar} coins/$)`
    : "";

  const loadBuyConfig = useCallback(() => {
    return axios
      .get("/api/payment/config")
      .then((res) => {
        if (!isMountedRef.current) return;
        setBuyConfig(res.data);
      })
      .catch((e) => {
        if (isMountedRef.current) console.error("Unable to load buy config", e);
      });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setSelectedAmount("");
    setIsProcessingPurchase(false);
    setBuyConfig(null);
    loadBuyConfig();
  }, [loadBuyConfig, open]);

  const handleAmountChange = (newAmount) => {
    setSelectedAmount(newAmount);
  };

  const buyCoinsWithBalance = () => {
    if (!isCoinAmountValid || !hasEnoughBalance) return;

    setIsProcessingPurchase(true);
    axios
      .post("/api/payment/balance/buyCoins", {
        amount: selectedAmountNumber,
      })
      .then((res) => {
        if (!isMountedRef.current) return;
        user.set((prev) => ({
          ...prev,
          coins: res.data.balance,
          balanceDollar: res.data.balanceDollar,
        }));
        siteInfo.showAlert(
          `Purchased ${res.data.coinsAdded} coins successfully.`,
          "success"
        );
        onClose();
      })
      .catch((e) => {
        if (isMountedRef.current) errorAlert(e);
      })
      .finally(() => {
        if (isMountedRef.current) setIsProcessingPurchase(false);
      });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Buy Coins</DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {presetAmounts.map((amt) => (
              <Button
                key={amt}
                variant={selectedAmount === amt ? "contained" : "outlined"}
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
            onChange={(e) => {
              const value = e.target.value;
              handleAmountChange(value === "" ? "" : Number(value));
            }}
            error={amountError}
            helperText={
              amountError
                ? `Minimum custom amount is ${MIN_COIN_PURCHASE_AMOUNT} coins.`
                : priceHelperText
            }
            inputProps={{ min: MIN_COIN_PURCHASE_AMOUNT, step: 1 }}
          />

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
                Dollar balance
              </Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {formatUsdAmount(balanceDollar)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Selected price: {formatUsdAmount(selectedPrice)}
              </Typography>
            </Box>
          )}

          {isCoinAmountValid && !hasEnoughBalance && (
            <Typography variant="body2" color="error">
              You need {formatUsdAmount(selectedPrice)} in dollar balance to buy
              these coins.
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={!isCoinAmountValid || !hasEnoughBalance || isProcessingPurchase}
            onClick={buyCoinsWithBalance}
          >
            {isProcessingPurchase ? "Processing..." : "Buy Coins"}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
