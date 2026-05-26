import React, { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { Box, IconButton, Portal } from "@mui/material";

import { UserContext } from "../Contexts";
import DailySpinModal from "./DailySpinModal";

const WHEEL_COLORS = [
  "#ff2e63",
  "#ffb703",
  "#00d1ff",
  "#36f56f",
  "#9b5cff",
  "#ff7a00",
];

export default function DailySpinFloatingButton() {
  const user = useContext(UserContext);
  const [dailySpinDialogOpen, setDailySpinDialogOpen] = useState(false);
  const [spinStatus, setSpinStatus] = useState(null);

  const loadSpinStatus = useCallback(() => {
    if (!user.loggedIn) {
      setSpinStatus(null);
      return Promise.resolve();
    }

    return axios
      .get("/api/user/daily-spin")
      .then((res) => setSpinStatus(res.data))
      .catch(() => setSpinStatus(null));
  }, [user.loggedIn]);

  useEffect(() => {
    loadSpinStatus();
  }, [loadSpinStatus]);

  useEffect(() => {
    if (!user.loggedIn || !spinStatus?.nextSpinAt || spinStatus.canSpin) return undefined;

    const delay = Math.max(1000, Number(spinStatus.nextSpinAt) - Date.now() + 1000);
    const timer = setTimeout(loadSpinStatus, delay);

    return () => clearTimeout(timer);
  }, [loadSpinStatus, spinStatus?.canSpin, spinStatus?.nextSpinAt, user.loggedIn]);

  if (!user.loggedIn) return null;

  return (
    <Portal>
      {spinStatus?.canSpin && (
        <IconButton
          onClick={() => setDailySpinDialogOpen(true)}
          title="Daily Spin"
          aria-label="Daily Spin"
          sx={(theme) => ({
            position: "fixed",
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: theme.zIndex.tooltip,
            width: 58,
            height: 58,
            p: 0,
            color: "#ffffff",
            backgroundColor: "background.paper",
            border: "2px solid rgba(255,255,255,0.42)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.38)",
            "&:hover": {
              backgroundColor: "background.paper",
            },
          })}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: "relative",
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: `conic-gradient(${WHEEL_COLORS.map(
                (color, index) =>
                  `${color} ${index * (360 / WHEEL_COLORS.length)}deg ${
                    (index + 1) * (360 / WHEEL_COLORS.length)
                  }deg`
              ).join(", ")})`,
              border: "3px solid rgba(255,255,255,0.9)",
              boxShadow: "inset 0 0 0 2px rgba(9,16,24,0.28)",
              animation: "daily-spin-float-wheel 1.2s linear infinite",
              "@keyframes daily-spin-float-wheel": {
                "0%": {
                  transform: "rotate(0deg)",
                },
                "100%": {
                  transform: "rotate(360deg)",
                },
              },
              "&::before": {
                content: '""',
                position: "absolute",
                inset: "50% auto auto 50%",
                width: 11,
                height: 11,
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                border: "2px solid rgba(9,16,24,0.42)",
                transform: "translate(-50%, -50%)",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                top: -7,
                left: "50%",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "10px solid #ffffff",
                transform: "translateX(-50%)",
                filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
              },
            }}
          />
        </IconButton>
      )}
      <DailySpinModal
        open={dailySpinDialogOpen}
        onClose={() => setDailySpinDialogOpen(false)}
        onStatusChange={setSpinStatus}
        user={user}
      />
    </Portal>
  );
}
