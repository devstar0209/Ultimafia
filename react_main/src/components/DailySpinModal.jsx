import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Wheel } from "react-custom-roulette";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

import { useErrorAlert } from "components/Alerts";

const DEFAULT_REWARDS = [5, 10, 15, 20, 30, 50, 30, 20, 15, 10, 5];
const WHEEL_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#db2777",
  "#0f766e",
  "#475569",
];

function buildRewardImageUri(reward) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="140" height="112" viewBox="0 0 140 112">
      <style>
        .amount {
          fill: #ffffff;
          font: 800 50px Roboto, Helvetica, Arial, sans-serif;
          paint-order: stroke;
          stroke: rgba(9, 16, 24, 0.65);
          stroke-width: 5px;
        }
      </style>
      <text class="amount" x="70" y="38" text-anchor="middle">${reward}</text>
      <g transform="translate(38 52)">
        <ellipse cx="26" cy="10" rx="24" ry="9" fill="#ffe082" stroke="#9a6400" stroke-width="3"/>
        <path d="M2 10v19c0 5 11 9 24 9s24-4 24-9V10" fill="#f5c542" stroke="#9a6400" stroke-width="3"/>
        <ellipse cx="26" cy="29" rx="24" ry="9" fill="#ffc107" stroke="#9a6400" stroke-width="3"/>
        <ellipse cx="39" cy="19" rx="24" ry="9" fill="#ffe082" stroke="#9a6400" stroke-width="3"/>
        <path d="M15 19v19c0 5 11 9 24 9s24-4 24-9V19" fill="#f5c542" stroke="#9a6400" stroke-width="3"/>
        <ellipse cx="39" cy="38" rx="24" ry="9" fill="#ffc107" stroke="#9a6400" stroke-width="3"/>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatSpinTime(timestamp) {
  const diff = Math.max(0, Number(timestamp || 0) - Date.now());
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.ceil((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (hours <= 0) return `${Math.max(1, minutes)}m`;
  if (minutes <= 0 || minutes === 60) return `${hours + (minutes === 60 ? 1 : 0)}h`;
  return `${hours}h ${minutes}m`;
}

export default function DailySpinModal({ open, onClose, onStatusChange, user }) {
  const errorAlert = useErrorAlert();
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const errorAlertRef = useRef(errorAlert);

  const rewards = useMemo(() => {
    const apiRewards = status?.rewards?.map((reward) => Number(reward.coins));
    return apiRewards?.length ? apiRewards : DEFAULT_REWARDS;
  }, [status?.rewards]);

  const wheelData = useMemo(
    () =>
      rewards.map((reward, index) => ({
        image: {
          uri: buildRewardImageUri(reward),
          sizeMultiplier: 0.48,
          offsetX: 0,
          offsetY: 50,
        },
        style: {
          backgroundColor: WHEEL_COLORS[index % WHEEL_COLORS.length],
          textColor: "#ffffff",
          fontSize: 24,
          fontFamily:
            "Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji, sans-serif",
        },
      })),
    [rewards]
  );

  useEffect(() => {
    errorAlertRef.current = errorAlert;
  }, [errorAlert]);

  const loadStatus = useCallback(() => {
    setIsLoading(true);
    return axios
      .get("/api/user/daily-spin")
      .then((res) => {
        setStatus(res.data);
        onStatusChange?.(res.data);
        setResult(null);
      })
      .catch((e) => errorAlertRef.current(e))
      .finally(() => setIsLoading(false));
  }, [onStatusChange]);

  useEffect(() => {
    if (open) loadStatus();
  }, [loadStatus, open]);

  function spin() {
    if (!status?.canSpin || isSpinning) return;

    setIsSpinning(true);
    setResult(null);

    axios
      .post("/api/user/daily-spin")
      .then((res) => {
        const reward = Number(res.data.reward || 0);
        const apiRewardIndex = Number(res.data.rewardIndex);
        const rewardIndex =
          Number.isInteger(apiRewardIndex) &&
          apiRewardIndex >= 0 &&
          apiRewardIndex < rewards.length
            ? apiRewardIndex
            : Math.max(0, rewards.indexOf(reward));

        setPrizeNumber(rewardIndex);
        setPendingResult(reward);
        setStatus(res.data);
        onStatusChange?.(res.data);
        user.set((prev) => ({
          ...prev,
          coins: Number(res.data.coins || prev.coins || 0),
        }));
      })
      .catch((e) => {
        setIsSpinning(false);
        if (e.response?.data?.message) {
          setStatus(e.response.data);
          onStatusChange?.(e.response.data);
          errorAlert(e.response.data.message);
          return;
        }
        errorAlert(e);
      });
  }

  function handleStopSpinning() {
    setIsSpinning(false);
    setResult(pendingResult);
    setPendingResult(null);
  }

  const canSpin = Boolean(status?.canSpin);
  const buttonText = isLoading
    ? "Loading..."
    : isSpinning
      ? "Spinning..."
      : canSpin
        ? "Spin"
        : "Claimed";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pr: 1,
        }}
      >
        <Typography variant="h3" component="span">
          Daily Lucky Spin
        </Typography>
        <IconButton onClick={onClose} aria-label="Close daily spin" size="small">
          <Box component="i" className="fas fa-times" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="column" spacing={2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 262,
              maxWidth: "100%",
              display: "flex",
              justifyContent: "center",
              filter: "drop-shadow(0 20px 28px rgba(0,0,0,0.35))",
              "& > div": {
                maxWidth: "100%",
                maxHeight: 262,
              },
            }}
          >
            <Wheel
              mustStartSpinning={isSpinning && pendingResult !== null}
              prizeNumber={prizeNumber}
              data={wheelData}
              onStopSpinning={handleStopSpinning}
              startingOptionIndex={prizeNumber}
              backgroundColors={WHEEL_COLORS}
              textColors={["#ffffff"]}
              outerBorderColor="rgba(255,255,255,0.3)"
              outerBorderWidth={4}
              innerRadius={12}
              innerBorderColor="rgba(255,255,255,0.28)"
              innerBorderWidth={3}
              radiusLineColor="rgba(9,16,24,0.32)"
              radiusLineWidth={2}
              fontFamily="Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji, sans-serif"
              fontSize={24}
              perpendicularText
              textDistance={60}
              spinDuration={0.85}
            />
          </Box>

          {result ? (
            <Typography variant="h3" sx={{ textAlign: "center" }}>
              You won {result.toLocaleString()} <Box component="i" className="fas fa-coins" sx={{ color: "#f5c542" }} />.
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ textAlign: "center", opacity: 0.8 }}>
              {canSpin
                ? "Spin once per day for a coin reward."
                : status?.nextSpinAt
                  ? `Next spin in ${formatSpinTime(status.nextSpinAt)}.`
                  : "Loading spin status..."}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={isLoading || isSpinning || !canSpin}
            onClick={spin}
            startIcon={<Box component="i" className="fas fa-sync-alt" />}
          >
            {buttonText}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
