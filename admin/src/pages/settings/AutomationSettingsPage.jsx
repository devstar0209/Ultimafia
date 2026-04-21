import React from "react";
import { Grid } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminSettingsSummary } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function AutomationSettingsPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminSettingsSummary);
  const automationRules = data?.automationRules || [];
  const filteredRules = filterRows(automationRules, search, [
    "name",
    "trigger",
    "owner",
    "status",
  ]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading automation"
        description="Fetching automation rules and their current status from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Automation unavailable"
        description="The admin panel could not load automation rules from the backend."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={8}>
        <MiniTable
          eyebrow="Automation"
          title="Automation Rules"
          subtitle="Use automations to route incidents, notify staff, and reduce repetitive admin work."
          columns={["Rule", "Trigger", "Owner", "Impact", "Status"]}
          rows={filteredRules.map((rule) => [
            rule.name,
            rule.trigger,
            rule.owner,
            rule.impact,
            <StatusChip key={`${rule.name}-status`} label={rule.status} />,
          ])}
        />
      </Grid>
      <Grid item xs={12} xl={4}>
        <ActionCard
          title="Automation Ideas"
          actions={[
            "Send flagged users directly into trust review queues.",
            "Auto-notify live ops when queue waits cross thresholds.",
            "Schedule staged price items without manual publishing.",
            "Alert creative admins when avatar approvals exceed SLA.",
          ]}
        />
      </Grid>
    </Grid>
  );
}
