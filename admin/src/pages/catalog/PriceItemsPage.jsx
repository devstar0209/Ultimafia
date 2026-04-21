import React from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

import ActionCard from "../../components/admin/ActionCard";
import MiniTable from "../../components/admin/MiniTable";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import { getShopInfo } from "../../services/adminService";
import { filterRows } from "../../utils/filterRows";

function getShopItemType(item) {
  const key = String(item.key || "").toLowerCase();

  if (key.includes("color") || key.includes("profile") || key.includes("icon")) {
    return "Customization";
  }

  if (key.includes("name")) {
    return "Identity";
  }

  if (key.includes("stamp")) {
    return "Collectible";
  }

  if (key.includes("family")) {
    return "Community";
  }

  return "Utility";
}

function getShopItemStatus(item) {
  if (item.limit == null) return "Repeatable";
  if (Number(item.limit) === 1) return "Approved";
  return "Limited";
}

export default function PriceItemsPage({ search = "" }) {
  const { data, loading, error } = useAdminQuery(getShopInfo);
  const priceItems = (data?.shopItems || []).map((item) => ({
    ...item,
    sku: item.key,
    type: getShopItemType(item),
    priceLabel: `${Number(item.price || 0)} coins`,
    currency: "Coins",
    status: getShopItemStatus(item),
  }));
  const filteredItems = filterRows(priceItems, search, [
    "name",
    "sku",
    "status",
    "currency",
    "type",
  ]);
  const repeatableCount = priceItems.filter((item) => item.limit == null).length;
  const limitedCount = priceItems.filter((item) => item.limit != null).length;
  const totalCoinValue = priceItems.reduce(
    (sum, item) => sum + Number(item.price || 0),
    0
  );

  if (loading) {
    return (
      <PageFeedback
        title="Loading price items"
        description="Fetching the current shop configuration from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Price items unavailable"
        description="The admin panel could not load shop item configuration from the backend."
      />
    );
  }

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
            item.priceLabel,
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
            subtitle="Current item configuration from the live backend shop endpoint."
          >
            <Stack spacing={1.25}>
              {[
                `${priceItems.length} price items are configured in the shop.`,
                `${repeatableCount} items can be purchased more than once.`,
                `${limitedCount} items have ownership limits.`,
                `${totalCoinValue} total coins across the current catalog.`,
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
              "Review coin prices before changing player economy.",
              "Move catalog editing behind dedicated admin write endpoints.",
              "Persist future storefront changes in Mongo instead of code config.",
            ]}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
