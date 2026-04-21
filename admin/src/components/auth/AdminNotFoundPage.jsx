import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

export default function AdminNotFoundPage({ loading = false }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        background:
          "radial-gradient(circle at top, rgba(255,140,66,0.12), transparent 28%), radial-gradient(circle at bottom left, rgba(95,209,199,0.12), transparent 22%), #0f141a",
      }}
    >
      <Paper sx={{ p: { xs: 3, md: 4 }, width: "100%", maxWidth: 520 }}>
        <Stack spacing={1.5}>
          <Typography
            sx={{
              color: "secondary.light",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Checking Access" : "404"}
          </Typography>
          <Typography variant="h2">
            {loading ? "Verifying admin access." : "Page not found."}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
