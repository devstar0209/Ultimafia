import React from "react";
import { Grid, Paper, Stack, Typography } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { games } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function GameIncidentsPage({ search = "" }) {
  const incidentRows = filterRows(games, search, [
    "title",
    "health",
    "incident",
    "host",
  ]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={6}>
        <SectionCard
          eyebrow="Interventions"
          title="Game Incident Board"
          subtitle="Incidents deserve a separate page so admins can focus on investigations without losing queue context."
        >
          <Stack spacing={2}>
            {incidentRows.map((game) => (
              <Paper
                key={game.id}
                sx={{
                  p: 2,
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="h4">{game.title}</Typography>
                    <StatusChip label={game.health} />
                  </Stack>
                  <Typography color="text.secondary">{game.incident}</Typography>
                  <Typography variant="caption" color="secondary.light">
                    Host: {game.host} • Region: {game.region}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </SectionCard>
      </Grid>
      <Grid item xs={12} lg={6}>
        <ActionCard
          title="Incident Workflow"
          actions={[
            "Freeze game chat logs before moderator review.",
            "Attach replay and system events to the case record.",
            "Notify involved staff when a game is force-paused.",
            "Resolve or escalate every incident with a final note.",
          ]}
        />
      </Grid>
    </Grid>
  );
}
