import React from "react";
import { Grid } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import StatusChip from "../../components/StatusChip";
import { automationRules } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function AutomationSettingsPage({ search = "" }) {
  const filteredRules = filterRows(automationRules, search, [
    "name",
    "trigger",
    "owner",
    "status",
  ]);

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
