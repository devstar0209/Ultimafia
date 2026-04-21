import React from "react";
import { Grid, LinearProgress, Paper, Stack, Typography } from "@mui/material";

import MiniTable from "../../components/admin/MiniTable";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { users } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function TrustSignalsPage({ search = "" }) {
  const flaggedUsers = filterRows(users, search, [
    "name",
    "status",
    "riskBand",
    "reports",
  ]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={5}>
        <SectionCard
          eyebrow="Risk Overview"
          title="Trust Signals"
          subtitle="Track account health across reports, trust scores, and moderation load."
        >
          <Stack spacing={2}>
            {flaggedUsers.map((user) => (
              <Paper
                key={user.id}
                sx={{
                  p: 2,
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="h4">{user.name}</Typography>
                    <StatusChip label={user.riskBand} />
                  </Stack>
                  <Typography color="text.secondary">
                    {user.reports} reports, trust score {user.trust}%, current
                    state {user.status.toLowerCase()}.
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(user.trust, 8)}
                    sx={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </SectionCard>
      </Grid>
      <Grid item xs={12} lg={7}>
        <MiniTable
          eyebrow="Signals Table"
          title="Flagged Accounts"
          subtitle="A trust-first page for rapid moderation review."
          columns={["User", "Status", "Reports", "Risk", "Last Action"]}
          rows={flaggedUsers.map((user) => [
            `${user.name} (${user.id})`,
            <StatusChip key={`${user.id}-status-chip`} label={user.status} />,
            user.reports,
            <StatusChip key={`${user.id}-risk-chip`} label={user.riskBand} />,
            user.lastAction,
          ])}
        />
      </Grid>
    </Grid>
  );
}
