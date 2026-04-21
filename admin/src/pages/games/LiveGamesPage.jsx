import React from "react";
import { Grid, Stack } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SummaryCard from "../../components/admin/SummaryCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminGames } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function LiveGamesPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminGames);
  const games = data?.items || [];
  const filteredGames = filterRows(games, search, [
    "id",
    "title",
    "host",
    "state",
    "health",
  ]);
  const investigatingCount = games.filter((game) => game.health === "Investigating").length;
  const reviewCount = games.filter((game) => game.health === "Needs Review").length;
  const totalPlayers = games.reduce((sum, game) => sum + Number(game.players || 0), 0);

  if (loading) {
    return (
      <PageFeedback
        title="Loading live games"
        description="Fetching active games and current health signals from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Live games unavailable"
        description="The admin panel could not load live game data from the backend."
      />
    );
  }

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
              `${games.length} live games loaded`,
              `${totalPlayers} players active across live games`,
              `${reviewCount} games currently need review`,
              `${investigatingCount} games under investigation`,
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
