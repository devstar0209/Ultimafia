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
  isSaving,
  onUpdateField,
  onSave,
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
          value={form.mode === "test" ? form.test_apiKey : form.apiKey}
          onChange={(e) =>
            onUpdateField("nowpayments", form.mode === "test" ? "test_apiKey" : "apiKey", e.target.value)
          }
          placeholder="Enter API key"
          required
        />

        <TextField
          label="Public Key *"
          type="text"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_publicKey : form.publicKey}
          onChange={(e) =>
            onUpdateField("nowpayments", form.mode === "test" ? "test_publicKey" : "publicKey", e.target.value)
          }
          placeholder="Enter Public key"
          required
        />

        <TextField
          label="IPN Secret Key"
          type="password"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_ipnSecretKey : form.ipnSecretKey}
          onChange={(e) =>
            onUpdateField("nowpayments", form.mode === "test" ? "test_ipnSecretKey" : "ipnSecretKey", e.target.value)
          }
          placeholder="Enter IPN secret key"
        />

        <TextField
          label="Base URL"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_baseUrl : form.baseUrl}
          onChange={(e) =>
            onUpdateField("nowpayments", form.mode === "test" ? "test_baseUrl" : "baseUrl", e.target.value)
          }
          placeholder="https://api.nowpayments.io"
        />

        <TextField
          label="Default Currencies"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_defaultCurrencies : form.defaultCurrencies}
          onChange={(e) =>
            onUpdateField("nowpayments", form.mode === "test" ? "test_defaultCurrencies" : "defaultCurrencies", e.target.value)
          }
          placeholder="comma-separated (e.g., btc,eth,usdttrc20)"
          helperText="Comma-separated list of default currencies"
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
        </Stack>
      </Stack>
    </SectionCard>
  );
}
