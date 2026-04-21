import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import MiniTable from "../../components/admin/MiniTable";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { gameQueues } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function QueueHealthPage({ search = "" }) {
  const filteredQueues = filterRows(gameQueues, search, [
    "name",
    "mode",
    "state",
    "region",
  ]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={7}>
        <MiniTable
          eyebrow="Matchmaking"
          title="Queue Health"
          subtitle="Compare fill rates, wait times, and queue state across the main game surfaces."
          columns={["Queue", "Mode", "Players", "Wait", "State", "Region"]}
          rows={filteredQueues.map((queue) => [
            queue.name,
            queue.mode,
            queue.players,
            queue.wait,
            <StatusChip key={`${queue.name}-state`} label={queue.state} />,
            queue.region,
          ])}
        />
      </Grid>
      <Grid item xs={12} lg={5}>
        <SectionCard
          eyebrow="Operator Notes"
          title="Queue Recommendations"
          subtitle="Use these levers when traffic shifts quickly."
        >
          <Stack spacing={1.25}>
            {[
              "Merge low-traffic queues during off-hours.",
              "Promote featured setups when wait exceeds 3 minutes.",
              "Rate-limit bot lobbies when ranked queues spike.",
              "Surface queue-state alerts in the top bar.",
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1.25}>
                <Icon
                  icon="solar:cup-star-bold-duotone"
                  style={{ fontSize: 18 }}
                />
                <Typography>{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      </Grid>
    </Grid>
  );
}
