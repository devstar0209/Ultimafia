import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminQueues } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function QueueHealthPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminQueues);
  const gameQueues = data?.items || [];
  const filteredQueues = filterRows(gameQueues, search, [
    "name",
    "mode",
    "state",
    "region",
  ]);
  const reviewQueues = filteredQueues.filter((queue) => queue.state !== "Healthy").length;
  const busiestQueue = [...filteredQueues].sort(
    (left, right) => Number(right.players || 0) - Number(left.players || 0)
  )[0];

  if (loading) {
    return (
      <PageFeedback
        title="Loading queue health"
        description="Fetching queue traffic and current wait-state data from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Queue health unavailable"
        description="The admin panel could not load queue metrics from the backend."
      />
    );
  }

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
          subtitle="Live guidance based on the current queue snapshot."
        >
          <Stack spacing={1.25}>
            {[
              `${filteredQueues.length} queues are currently visible to admins.`,
              `${reviewQueues} queues are marked for review or intervention.`,
              busiestQueue
                ? `${busiestQueue.name} is the busiest queue with ${busiestQueue.players} players.`
                : "No queue traffic is available right now.",
              "Use this page to spot empty open queues before users feel the delay.",
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
