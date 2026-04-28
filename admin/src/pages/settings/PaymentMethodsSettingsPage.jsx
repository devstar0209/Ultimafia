import React, { useEffect, useState } from "react";
import {
  Alert,
  Grid,
  Stack,
} from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import PageFeedback from "../../components/admin/PageFeedback";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminPaymentMethods,
  updateAdminPaymentMethod,
  deleteAdminPaymentMethod,
} from "../../services/adminService";
import BraintreeForm from "./components/BraintreeForm";
import StripeForm from "./components/StripeForm";
import NowPaymentsForm from "./components/NowPaymentsForm";

export default function PaymentMethodsSettingsPage() {
  const { data, loading, error, refetch } = useAdminQuery(getAdminPaymentMethods);
  const [feedback, setFeedback] = useState(null);
  const [savingProvider, setSavingProvider] = useState(null);
  const [deletingProvider, setDeletingProvider] = useState(null);

  // Form state per provider
  const [formState, setFormState] = useState({
    nowpayments: { mode: "test", active: false, apiKey: "", baseUrl: "", defaultCurrencies: "", ipnUrl: "", webhookUrl: "" },
    braintree: { mode: "test", active: false, apiKey: "", baseUrl: "", defaultCurrencies: "", ipnUrl: "", webhookUrl: "" },
    stripe: { mode: "test", active: false, apiKey: "", baseUrl: "", defaultCurrencies: "", ipnUrl: "", webhookUrl: "" },
  });

  const paymentMethods = data?.items || [];

  // Initialize form state from data
  useEffect(() => {
    if (paymentMethods.length > 0) {
      const newFormState = { ...formState };
      paymentMethods.forEach((pm) => {
        newFormState[pm.provider] = {
          mode: pm.mode || "test",
          active: pm.active || false,
          apiKey: pm.apiKey || "",
          baseUrl: pm.baseUrl || "",
          defaultCurrencies: pm.defaultCurrencies || "",
          ipnUrl: pm.ipnUrl || "",
          webhookUrl: pm.webhookUrl || "",
        };
      });
      setFormState(newFormState);
    }
  }, [paymentMethods]);

  function updateProviderField(provider, field, value) {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  }

  async function handleSavePaymentMethod(provider) {
    const form = formState[provider];

    if (!form.apiKey.trim()) {
      setFeedback({
        type: "error",
        message: `API Key is required for ${provider}.`,
      });
      return;
    }

    setSavingProvider(provider);
    try {
      await updateAdminPaymentMethod(provider, {
        mode: form.mode,
        active: form.active,
        apiKey: form.apiKey,
        baseUrl: form.baseUrl,
        defaultCurrencies: form.defaultCurrencies,
        ipnUrl: form.ipnUrl,
        webhookUrl: form.webhookUrl,
      });

      setFeedback({
        type: "success",
        message: `${provider} payment method updated successfully.`,
      });

      refetch();
    } catch (e) {
      setFeedback({
        type: "error",
        message:
          e.response?.data || `Failed to update ${provider} payment method. Please try again.`,
      });
    } finally {
      setSavingProvider(null);
    }
  }

  async function handleDeletePaymentMethod(provider) {
    setDeletingProvider(provider);
    try {
      await deleteAdminPaymentMethod(provider);

      setFeedback({
        type: "success",
        message: `${provider} payment method deleted successfully.`,
      });

      refetch();
    } catch (e) {
      setFeedback({
        type: "error",
        message: e.response?.data || `Failed to delete ${provider} payment method.`,
      });
    } finally {
      setDeletingProvider(null);
    }
  }

  if (loading) {
    return (
      <PageFeedback
        title="Loading payment methods"
        description="Fetching payment method configurations from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Payment methods unavailable"
        description="The payment methods configuration could not be loaded."
      />
    );
  }

  return (
    <Stack spacing={3}>
      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Payment Method Forms - 3 Columns */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <NowPaymentsForm
            form={formState.nowpayments}
            methodData={paymentMethods.find((pm) => pm.provider === "nowpayments")}
            isSaving={savingProvider === "nowpayments"}
            isDeleting={deletingProvider === "nowpayments"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
            onDelete={handleDeletePaymentMethod}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <BraintreeForm
            form={formState.braintree}
            methodData={paymentMethods.find((pm) => pm.provider === "braintree")}
            isSaving={savingProvider === "braintree"}
            isDeleting={deletingProvider === "braintree"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
            onDelete={handleDeletePaymentMethod}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StripeForm
            form={formState.stripe}
            methodData={paymentMethods.find((pm) => pm.provider === "stripe")}
            isSaving={savingProvider === "stripe"}
            isDeleting={deletingProvider === "stripe"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
            onDelete={handleDeletePaymentMethod}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
