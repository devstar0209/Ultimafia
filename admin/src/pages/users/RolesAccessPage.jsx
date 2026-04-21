import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminUsers } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function RolesAccessPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminUsers);
  const users = data?.items || [];
  const roleRows = filterRows(users, search, [
    "name",
    "role",
    "region",
    "status",
  ]);
  const roleCounts = Array.from(
    roleRows.reduce((counts, user) => {
      const key = user.role || "Player";
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map())
  ).sort((left, right) => right[1] - left[1]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading roles"
        description="Fetching user roles and access scopes from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Roles unavailable"
        description="The admin panel could not load role and access data from the backend."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={7}>
        <MiniTable
          eyebrow="Permissions"
          title="Roles & Access"
          subtitle="Control which team members can moderate, publish, or update pricing and settings."
          columns={["Staff", "Role", "Region", "Status", "Scope"]}
          rows={roleRows.map((user) => [
            user.name,
            user.role,
            user.region,
            <StatusChip key={`${user.id}-role-status`} label={user.status} />,
            user.scope,
          ])}
        />
      </Grid>
      <Grid item xs={12} xl={5}>
        <Stack spacing={3}>
          <SectionCard
            eyebrow="Access Matrix"
            title="Permission Buckets"
            subtitle="Current role distribution pulled from the live user directory."
          >
            <Stack spacing={1.25}>
              {roleCounts.map(([role, count]) => (
                <Stack key={role} direction="row" spacing={1.25}>
                  <Icon
                    icon="solar:key-minimalistic-2-bold-duotone"
                    style={{ fontSize: 18 }}
                  />
                  <Typography>{`${role}: ${count} account${count === 1 ? "" : "s"}`}</Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
          <ActionCard
            title="Next Steps"
            actions={[
              "Add per-page permission guards when write actions are introduced.",
              "Show role-based quick actions in the header.",
              "Block access changes without audit trail confirmation.",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
