import React from "react";
import { Grid, Paper, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import MetricCard from "../components/MetricCard";
import HeroBanner from "../components/admin/HeroBanner";
import MiniTable from "../components/admin/MiniTable";
import ActionCard from "../components/admin/ActionCard";
import SectionCard from "../components/SectionCard";
import StatusChip from "../components/StatusChip";
import { activityFeed, adminStats, alerts } from "../data/mockData";

export default function OverviewPage() {
  return (
    <Stack spacing={3}>
      <HeroBanner />

      <Grid container spacing={2}>
        {adminStats.map((metric) => (
          <Grid item xs={12} sm={6} xl={3} key={metric.label}>
            <MetricCard {...metric} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} xl={8}>
          <SectionCard
            eyebrow="Live Radar"
            title="Platform Attention Board"
            subtitle="The highest-signal admin areas that are likely to need action this shift."
          >
            <Grid container spacing={2}>
              {alerts.map((alert) => (
                <Grid item xs={12} md={4} key={alert}>
                  <Paper
                    sx={{
                      p: 2,
                      minHeight: 150,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                    }}
                  >
                    <Stack spacing={2}>
                      <Icon
                        icon="solar:danger-triangle-bold-duotone"
                        style={{ fontSize: 24 }}
                      />
                      <Typography>{alert}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>
        <Grid item xs={12} xl={4}>
          <SectionCard
            eyebrow="Shift Activity"
            title="Recent Actions"
            subtitle="A quick view of what the admin team has done lately."
          >
            <Stack spacing={2}>
              {activityFeed.map((item) => (
                <Paper
                  key={item.title}
                  sx={{
                    p: 2,
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Stack spacing={0.75}>
                    <Typography variant="h4">{item.title}</Typography>
                    <Typography color="text.secondary">
                      {item.description}
                    </Typography>
                    <Typography variant="caption" color="secondary.light">
                      {item.when}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <MiniTable
            eyebrow="Top Queues"
            title="Store and Gameplay Pulse"
            subtitle="A cross-section of the busiest admin-managed surfaces."
            columns={["Area", "State", "Owner", "Attention"]}
            rows={[
              [
                "Price items",
                <StatusChip key="price-items" label="Review" />,
                "Commerce Ops",
                "2 pending price changes",
              ],
              [
                "Avatars",
                <StatusChip key="avatars" label="Pending" />,
                "Creative Team",
                "11 unapproved assets",
              ],
              [
                "Live games",
                <StatusChip key="running" label="Running" />,
                "Live Ops",
                "3 matches under watch",
              ],
            ]}
          />
        </Grid>
        <Grid item xs={12} lg={5}>
          <ActionCard
            title="Launch Checklist"
            actions={[
              "Wire each page to `/api/admin/*` endpoints.",
              "Add permission gates for staff roles and page access.",
              "Connect destructive actions to audit logging.",
              "Persist filters, search, and saved admin views.",
            ]}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
