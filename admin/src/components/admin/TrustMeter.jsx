import React from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";

export default function TrustMeter({ value }) {
  return (
    <Stack spacing={0.5} sx={{ minwidth: 110 }}>
      <Typography variant="caption">{value}%</Typography>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 8,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />
    </Stack>
  );
}
