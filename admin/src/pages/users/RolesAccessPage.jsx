import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { users } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function RolesAccessPage({ search = "" }) {
  const roleRows = filterRows(users, search, [
    "name",
    "role",
    "region",
    "status",
  ]);

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
            subtitle="Use separate scopes so sensitive actions stay tightly controlled."
          >
            <Stack spacing={1.25}>
              {[
                "Community Moderators: user status, reports, appeals",
                "Live Ops: game pause, queue banners, emergency messaging",
                "Commerce Admins: price items, bundles, release windows",
                "Creative Admins: avatars, approval, publishing workflow",
              ].map((item) => (
                <Stack key={item} direction="row" spacing={1.25}>
                  <Icon
                    icon="solar:key-minimalistic-2-bold-duotone"
                    style={{ fontSize: 18 }}
                  />
                  <Typography>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
          <ActionCard
            title="Next Steps"
            actions={[
              "Add per-page permission guards.",
              "Show role-based quick actions in the header.",
              "Block access changes without audit trail confirmation.",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
