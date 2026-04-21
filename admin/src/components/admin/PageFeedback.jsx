import React from "react";
import { Button, Stack, Typography } from "@mui/material";

import SectionCard from "../SectionCard";

export default function PageFeedback({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <SectionCard title={title}>
      <Stack spacing={2}>
        <Typography color="text.secondary">{description}</Typography>
        {actionLabel && onAction ? (
          <Button variant="contained" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
