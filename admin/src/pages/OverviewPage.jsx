import React from "react";
import { Grid, Paper, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import ActionCard from "../components/admin/ActionCard";
import HeroBanner from "../components/admin/HeroBanner";
import MiniTable from "../components/admin/MiniTable";
import PageFeedback from "../components/admin/PageFeedback";
import MetricCard from "../components/MetricCard";
import SectionCard from "../components/SectionCard";
import useAdminQuery from "../hooks/useAdminQuery";
import { getAdminOverview } from "../services/adminService";

export default function OverviewPage() {
  const { data, loading, error } = useAdminQuery(getAdminOverview);

  if (loading) {
    return (
      <PageFeedback
        title="Loading overview"
        description="Pulling the latest admin metrics, alerts, and recent activity from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Overview unavailable"
        description="The admin overview could not be loaded from the backend right now."
      />
    );
  }

  const adminStats = data?.stats || [];
  const alerts = data?.alerts || [];
  const activityFeed = data?.activityFeed || [];

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
            eyebrow="Live Pulse"
            title="Operational Snapshot"
            subtitle="A backend-driven summary of the current admin surfaces."
            columns={["Area", "Current", "Signal", "Detail"]}
            rows={adminStats.map((metric) => [
              metric.label,
              metric.value,
              metric.delta,
              metric.detail,
            ])}
          />
        </Grid>
        <Grid item xs={12} lg={5}>
          <ActionCard
            title="Operator Checklist"
            actions={[
              "Review open tasks and flagged users at shift start.",
              "Check live-game alerts before queue traffic spikes.",
              "Confirm high-impact changes are covered by audit logging.",
              "Keep admin access restricted to admin-role sessions.",
            ]}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
