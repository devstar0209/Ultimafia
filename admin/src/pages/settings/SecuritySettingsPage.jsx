import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import MiniTable from "../../components/admin/MiniTable";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { moderationPolicies } from "../../data/mockData";

export default function SecuritySettingsPage() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={7}>
        <MiniTable
          eyebrow="Protection Rules"
          title="Security Policies"
          subtitle="Guardrails for moderation, access, and sensitive admin actions."
          columns={["Policy", "Scope", "Severity", "Owner", "Status"]}
          rows={moderationPolicies.map((policy) => [
            policy.name,
            policy.scope,
            <StatusChip key={`${policy.name}-severity`} label={policy.severity} />,
            policy.owner,
            <StatusChip key={`${policy.name}-status`} label={policy.status} />,
          ])}
        />
      </Grid>
      <Grid item xs={12} lg={5}>
        <SectionCard
          eyebrow="Security Notes"
          title="Recommended Guardrails"
          subtitle="A few patterns that fit well with this admin structure."
        >
          <Stack spacing={1.25}>
            {[
              "Require dual approval for bans, suspensions, and price changes.",
              "Log every role update with actor, target, and reason.",
              "Lock sensitive actions behind explicit confirmation dialogs.",
              "Separate avatar publishing from asset deletion rights.",
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1.25}>
                <Icon
                  icon="solar:shield-keyhole-bold-duotone"
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
