import React from "react";
import { Grid, Stack } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SummaryCard from "../../components/admin/SummaryCard";
import TrustMeter from "../../components/admin/TrustMeter";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getAdminUsers } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

export default function UsersDirectoryPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getAdminUsers);
  const users = data?.items || [];
  const filteredUsers = filterRows(users, search, [
    "id",
    "name",
    "role",
    "status",
    "email",
  ]);
  const staffCount = users.filter((user) => user.role && user.role !== "Player").length;
  const flaggedCount = users.filter((user) =>
    ["Flagged", "Suspended"].includes(user.status)
  ).length;
  const avatarCount = users.filter((user) => user.hasAvatar).length;

  if (loading) {
    return (
      <PageFeedback
        title="Loading users"
        description="Fetching the current user directory and role data from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="User directory unavailable"
        description="The admin panel could not load user records from the backend."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={8}>
        <MiniTable
          eyebrow="User Management"
          title="User Directory"
          subtitle="Manage account status, staff roles, reputation, and access from one searchable page."
          columns={["User", "Email", "Role", "Status", "Trust", "Last Seen"]}
          rows={filteredUsers.map((user) => [
            `${user.name} (${user.id})`,
            user.email,
            user.role,
            <StatusChip key={`${user.id}-status`} label={user.status} />,
            <TrustMeter key={`${user.id}-trust`} value={user.trust} />,
            user.lastSeen,
          ])}
        />
      </Grid>
      <Grid item xs={12} xl={4}>
        <Stack spacing={3}>
          <ActionCard
            title="Recommended Actions"
            actions={[
              "Review users with trust below 70%.",
              "Refresh dormant moderator access this week.",
              "Escalate repeat offenders into the trust workflow.",
            ]}
          />
          <SummaryCard
            title="Directory Summary"
            items={[
              `${users.length} recent accounts loaded`,
              `${staffCount} staff or elevated accounts`,
              `${flaggedCount} users currently flagged or suspended`,
              `${avatarCount} users with profile assets`,
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
