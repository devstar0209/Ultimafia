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

export default function BraintreeForm({
  form,
  isSaving,
  onUpdateField,
  onSave,
}) {
  return (
    <SectionCard
      eyebrow="Braintree"
      title="Braintree Configuration"
      subtitle="Configure Braintree payment gateway"
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
                onClick={() => onUpdateField("braintree", "mode", m)}
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
                onClick={() => onUpdateField("braintree", "active", status)}
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
          label="Merchant ID *"
          type="password"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_publicKey : form.publicKey}
          onChange={(e) =>
            onUpdateField("braintree", form.mode === "test" ? "test_publicKey" : "publicKey", e.target.value)
          }
          placeholder="Enter merchant ID"
          required
        />

        <TextField
          label="Public Key *"
          type="password"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_ipnSecretKey : form.ipnSecretKey}
          onChange={(e) =>
            onUpdateField("braintree", form.mode === "test" ? "test_ipnSecretKey" : "ipnSecretKey", e.target.value)
          }
          placeholder="Enter public key"
          required
        />

        <TextField
          label="Private Key *"
          type="password"
          fullWidth
          size="small"
          value={form.mode === "test" ? form.test_baseUrl : form.baseUrl}
          onChange={(e) =>
            onUpdateField("braintree", form.mode === "test" ? "test_baseUrl" : "baseUrl", e.target.value)
          }
          placeholder="Enter private key"
          required
        />

        <TextField
          label="Base URL"
          fullWidth
          size="small"
          value={form.baseUrl}
          onChange={(e) =>
            onUpdateField("braintree", "baseUrl", e.target.value)
          }
          placeholder="https://api.braintreegateway.com"
        />

        <TextField
          label="Default Currencies"
          fullWidth
          size="small"
          value={form.defaultCurrencies}
          onChange={(e) =>
            onUpdateField("braintree", "defaultCurrencies", e.target.value)
          }
          placeholder="comma-separated (e.g., USD,EUR,GBP)"
          helperText="Comma-separated list of default currencies"
        />

        <TextField
          label="IPN/Webhook URL"
          fullWidth
          size="small"
          value={form.ipnUrl}
          onChange={(e) =>
            onUpdateField("braintree", "ipnUrl", e.target.value)
          }
          placeholder="https://yoursite.com/webhooks/braintree"
        />

        <TextField
          label="Additional Webhook URL"
          fullWidth
          size="small"
          value={form.webhookUrl}
          onChange={(e) =>
            onUpdateField("braintree", "webhookUrl", e.target.value)
          }
          placeholder="https://yoursite.com/webhooks/additional"
        />

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          <Button
            variant="contained"
            onClick={() => onSave("braintree")}
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
