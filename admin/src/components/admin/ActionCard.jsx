import React from "react";
import { Icon } from "@iconify/react";
import { Stack, Typography } from "@mui/material";

import SectionCard from "../SectionCard";

export default function ActionCard({ title, actions }) {
  return (
    <SectionCard title={title}>
      <Stack spacing={1.2}>
        {actions.map((action) => (
          <Stack key={action} direction="row" spacing={1.25}>
            <Icon
              icon="solar:arrow-right-up-linear"
              style={{ fontSize: 18, marginTop: 2 }}
            />
            <Typography>{action}</Typography>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
