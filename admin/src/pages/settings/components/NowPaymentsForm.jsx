import React from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";

import SectionCard from "../../../components/SectionCard";
import StatusChip from "../../../components/StatusChip";

export default function NowPaymentsForm({
  form,
  methodData,
  isSaving,
  isDeleting,
  onUpdateField,
  onSave,
  onDelete,
}) {
  return (
    <SectionCard
      eyebrow="NowPayments"
      title="NowPayments Configuration"
      subtitle="Configure NowPayments payment gateway"
    >
      <Stack spacing={2}>
        {/* Mode Selection */}
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 1, display: "block" }}>
            Environment Mode
          </Typography>
          <Stack direction="row" spacing={1}>
            {["test", "prod"].map((m) => (
              <Button
                key={m}
                variant={form.mode === m ? "contained" : "outlined"}
                size="small"
                onClick={() => onUpdateField("nowpayments", "mode", m)}
                fullWidth
              >
                {m === "test" ? "Test" : "Prod"}
              </Button>
            ))}
          </Stack>
        </Box>

        {/* Status Selection */}
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 1, display: "block" }}>
            Status
          </Typography>
          <Stack direction="row" spacing={1}>
            {[true, false].map((status) => (
              <Button
                key={String(status)}
                variant={form.active === status ? "contained" : "outlined"}
                size="small"
                color={status ? "success" : "inherit"}
                onClick={() => onUpdateField("nowpayments", "active", status)}
                fullWidth
              >
                {status ? "Active" : "Inactive"}
              </Button>
            ))}
          </Stack>
        </Box>

        {/* Status Chips */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <StatusChip
            label={form.mode === "prod" ? "Production" : "Test"}
            color={form.mode === "prod" ? "success" : "warning"}
            size="small"
          />
          <StatusChip
            label={form.active ? "Active" : "Inactive"}
            color={form.active ? "success" : "default"}
            size="small"
          />
        </Box>

        {/* Form Fields */}
        <TextField
          label="API Key *"
          type="password"
          fullWidth
          size="small"
          value={form.apiKey}
          onChange={(e) =>
            onUpdateField("nowpayments", "apiKey", e.target.value)
          }
          placeholder="Enter API key"
          required
        />

        <TextField
          label="Base URL"
          fullWidth
          size="small"
          value={form.baseUrl}
          onChange={(e) =>
            onUpdateField("nowpayments", "baseUrl", e.target.value)
          }
          placeholder="https://api.nowpayments.io"
        />

        <TextField
          label="Default Currencies"
          fullWidth
          size="small"
          value={form.defaultCurrencies}
          onChange={(e) =>
            onUpdateField("nowpayments", "defaultCurrencies", e.target.value)
          }
          placeholder="comma-separated (e.g., btc,eth,usdttrc20)"
          helperText="Comma-separated list of default currencies"
        />

        <TextField
          label="IPN/Webhook URL"
          fullWidth
          size="small"
          value={form.ipnUrl}
          onChange={(e) =>
            onUpdateField("nowpayments", "ipnUrl", e.target.value)
          }
          placeholder="https://yoursite.com/webhooks/nowpayments"
        />

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          <Button
            variant="contained"
            onClick={() => onSave("nowpayments")}
            loading={isSaving}
            startIcon={<Icon icon="solar:check-circle-bold-duotone" />}
            fullWidth
          >
            Save Changes
          </Button>
          {methodData && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => onDelete("nowpayments")}
              loading={isDeleting}
              startIcon={<Icon icon="solar:trash-bin-bold-duotone" />}
            >
              Delete
            </Button>
          )}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
