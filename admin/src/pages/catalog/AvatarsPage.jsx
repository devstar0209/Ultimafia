import React from "react";
import { Chip, Grid, Paper, Stack, Typography } from "@mui/material";

import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminAvatars } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function AvatarsPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminAvatars);
  const avatars = data?.entries || [];
  const avatarCollections = data?.collections || [];
  const filteredAvatars = filterRows(avatars, search, [
    "name",
    "collection",
    "artist",
    "status",
    "rarity",
  ]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading avatars"
        description="Fetching avatar assets and collection summaries from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Avatar catalog unavailable"
        description="The admin panel could not load avatar asset data from the backend."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={7}>
        <MiniTable
          eyebrow="Assets"
          title="Avatar Catalog"
          subtitle="Review avatar assets, track collections, and manage publishing state for the store."
          columns={[
            "Avatar",
            "Collection",
            "Artist",
            "Rarity",
            "Status",
            "Updated",
          ]}
          rows={filteredAvatars.map((avatar) => [
            avatar.name,
            avatar.collection,
            avatar.artist,
            avatar.rarity,
            <StatusChip key={`${avatar.id}-status`} label={avatar.status} />,
            avatar.updated,
          ])}
        />
      </Grid>
      <Grid item xs={12} lg={5}>
        <SectionCard
          eyebrow="Collections"
          title="Avatar Collections"
          subtitle="Collection-level controls help admins keep releases intentional."
        >
          <Stack spacing={2}>
            {avatarCollections.length ? (
              avatarCollections.map((collection) => (
                <Paper
                  key={collection.name}
                  sx={{
                    p: 2,
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="h4">{collection.name}</Typography>
                      <Chip label={collection.count} size="small" />
                    </Stack>
                    <Typography color="text.secondary">
                      {collection.theme}
                    </Typography>
                    <Typography variant="caption" color="secondary.light">
                      {collection.releaseWindow}
                    </Typography>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <Typography color="text.secondary">
                  No avatar collections are available yet.
                </Typography>
              </Paper>
            )}
          </Stack>
        </SectionCard>
      </Grid>
    </Grid>
  );
}
