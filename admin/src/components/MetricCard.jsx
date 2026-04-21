import React from "react";
import { Chip, Paper, Stack, Typography } from "@mui/material";

export default function MetricCard({ label, value, delta, detail, tone }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        position: "relative",
        overflow: "hidden",
        minHeight: 182,
        background:
          "radial-gradient(circle at top right, rgba(255,140,66,0.22), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
      }}
    >
      <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography color="text.secondary">{label}</Typography>
          <Chip size="small" label={delta} color={tone} />
        </Stack>
        <Typography variant="h2">{value}</Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </Stack>
    </Paper>
  );
}
