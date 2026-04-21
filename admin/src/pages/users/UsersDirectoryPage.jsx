import React from "react";
import { Grid, Stack } from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import SummaryCard from "../../components/admin/SummaryCard";
import TrustMeter from "../../components/admin/TrustMeter";
import StatusChip from "../../components/StatusChip";
import { users } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function UsersDirectoryPage({ search = "" }) {
  const filteredUsers = filterRows(users, search, [
    "id",
    "name",
    "role",
    "status",
    "email",
  ]);

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
              "12480 active accounts",
              "42 staff accounts",
              "17 users currently flagged",
              "6 pending account reviews",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
