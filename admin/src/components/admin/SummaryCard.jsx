import React from "react";
import { Icon } from "@iconify/react";
import { Stack, Typography } from "@mui/material";

import SectionCard from "../SectionCard";

export default function SummaryCard({ title, items }) {
  return (
    <SectionCard title={title}>
      <Stack spacing={1.15}>
        {items.map((item) => (
          <Stack key={item} direction="row" spacing={1.25}>
            <Icon
              icon="solar:check-circle-bold-duotone"
              style={{ fontSize: 18 }}
            />
            <Typography>{item}</Typography>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
