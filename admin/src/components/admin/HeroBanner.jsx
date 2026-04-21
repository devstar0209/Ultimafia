import React from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function HeroBanner() {
  const navigate = useNavigate();

  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 4 },
        overflow: "hidden",
        position: "relative",
        background:
          "linear-gradient(135deg, rgba(255,140,66,0.22) 0%, rgba(22,33,43,0.92) 42%, rgba(95,209,199,0.2) 100%)",
      }}
    >
      <Stack spacing={2.5} sx={{ position: "relative", zIndex: 1 }}>
        <Typography
          sx={{
            color: "secondary.light",
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Shift Snapshot
        </Typography>
        <Typography variant="h1" sx={{ maxWidth: 820 }}>
          3 admins online, 11 tasks need review, and 2 pricing updates are
          pending release.
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
          Start the shift from here, then jump into users, games, price items,
          avatars, or settings from the left sidebar mega menu.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            onClick={() => navigate("/users/directory")}
          >
            Open daily handoff
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/catalog/price-items")}
          >
            Review price items
          </Button>
        </Stack>
      </Stack>
      <Box
        sx={{
          position: "absolute",
          inset: "auto -10% -20% auto",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          filter: "blur(20px)",
        }}
      />
    </Paper>
  );
}
