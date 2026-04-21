import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import { priceItems } from "../../data/mockData";
import { filterRows } from "../../utils/filterRows";

export default function PriceItemsPage({ search = "" }) {
  const filteredItems = filterRows(priceItems, search, [
    "name",
    "sku",
    "status",
    "currency",
    "type",
  ]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={8}>
        <MiniTable
          eyebrow="Commerce"
          title="Price Items"
          subtitle="Manage store items, bundles, featured pricing, and release windows."
          columns={["Item", "SKU", "Type", "Price", "Currency", "Status"]}
          rows={filteredItems.map((item) => [
            item.name,
            item.sku,
            item.type,
            item.price,
            item.currency,
            <StatusChip key={`${item.sku}-status`} label={item.status} />,
          ])}
        />
      </Grid>
      <Grid item xs={12} xl={4}>
        <Stack spacing={3}>
          <SectionCard
            eyebrow="Pricing Strategy"
            title="Commerce Summary"
            subtitle="Useful slices for administrators handling monetized inventory."
          >
            <Stack spacing={1.25}>
              {[
                "2 bundles ready for launch",
                "1 item hidden pending legal review",
                "Seasonal sale starts in 3 days",
                "3 price changes awaiting approval",
              ].map((item) => (
                <Stack key={item} direction="row" spacing={1.25}>
                  <Icon
                    icon="solar:tag-price-bold-duotone"
                    style={{ fontSize: 18 }}
                  />
                  <Typography>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
          <ActionCard
            title="Common Actions"
            actions={[
              "Duplicate an item into a limited-time bundle.",
              "Update a storefront price without touching code.",
              "Stage price changes before publishing them live.",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
