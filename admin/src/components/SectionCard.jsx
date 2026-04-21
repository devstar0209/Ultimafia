import React from "react";
import { Paper, Stack, Typography } from "@mui/material";

export default function SectionCard({ eyebrow, title, subtitle, children }) {
  return (
    <Paper
      sx={{
        p: { xs: 2, md: 3 },
        height: "100%",
      }}
    >
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          {eyebrow ? (
            <Typography
              variant="caption"
              sx={{
                color: "secondary.light",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Typography variant="h3">{title}</Typography>
          {subtitle ? (
            <Typography color="text.secondary">{subtitle}</Typography>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
