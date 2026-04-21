import React from "react";
import { Grid, Paper, Stack, Typography } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminSettingsSummary } from "../../services/adminService";

export default function GeneralSettingsPage() {
  const { data, loading, error } = useAdminQuery(getAdminSettingsSummary);
  const settingsModules = data?.modules || [];

  if (loading) {
    return (
      <PageFeedback
        title="Loading settings"
        description="Fetching the current admin settings summary from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Settings unavailable"
        description="The admin panel could not load general settings from the backend."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={7}>
        <SectionCard
          eyebrow="Platform Defaults"
          title="General Settings"
          subtitle="A home for operational defaults, branding, and high-level admin controls."
        >
          <Grid container spacing={2}>
            {settingsModules.map((module) => (
              <Grid item xs={12} md={6} key={module.title}>
                <Paper
                  sx={{
                    p: 2.25,
                    height: "100%",
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Stack spacing={1.2}>
                    <Typography variant="h4">{module.title}</Typography>
                    <Typography color="text.secondary">
                      {module.description}
                    </Typography>
                    <StatusChip label={module.status} />
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      </Grid>
      <Grid item xs={12} lg={5}>
        <ActionCard
          title="General Controls"
          actions={[
            "Edit global platform labels and announcement defaults.",
            "Manage release windows for store and event content.",
            "Tune default queue banners and landing copy.",
          ]}
        />
      </Grid>
    </Grid>
  );
}
