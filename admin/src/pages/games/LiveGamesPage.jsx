import React from "react";
import { Grid, Stack } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import SummaryCard from "../../components/admin/SummaryCard";
import StatusChip from "../../components/StatusChip";
import { games } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function LiveGamesPage({ search = "" }) {
  const filteredGames = filterRows(games, search, [
    "id",
    "title",
    "host",
    "state",
    "health",
  ]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={8}>
        <MiniTable
          eyebrow="Game Operations"
          title="Live Games"
          subtitle="Watch active matches, paused sessions, and lobbies needing moderator intervention."
          columns={["Game", "Host", "Players", "State", "Health", "Region"]}
          rows={filteredGames.map((game) => [
            `${game.title} (${game.id})`,
            game.host,
            game.players,
            <StatusChip key={`${game.id}-state`} label={game.state} />,
            <StatusChip key={`${game.id}-health`} label={game.health} />,
            game.region,
          ])}
        />
      </Grid>
      <Grid item xs={12} xl={4}>
        <Stack spacing={3}>
          <ActionCard
            title="Live Controls"
            actions={[
              "Pause matchmaking during incidents.",
              "Broadcast emergency messages to all lobbies.",
              "Move suspicious games into moderator review.",
            ]}
          />
          <SummaryCard
            title="Live Snapshot"
            items={[
              "214 games running",
              "12 waiting rooms nearing timeout",
              "3 paused for investigation",
              "Average fill time: 1m 38s",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
