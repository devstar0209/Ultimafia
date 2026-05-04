import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Grid,
  Stack,
} from "@mui/material";

import PageFeedback from "../../components/admin/PageFeedback";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminPaymentMethods,
  updateAdminPaymentMethod,
} from "../../services/adminService";
import BraintreeForm from "./components/BraintreeForm";
import StripeForm from "./components/StripeForm";
import NowPaymentsForm from "./components/NowPaymentsForm";

const PAYMENT_ENVIRONMENT_FIELDS = [
  "publicKey",
  "ipnSecretKey",
  "baseUrl",
  "defaultCurrencies",
  "test_publicKey",
  "test_ipnSecretKey",
  "test_baseUrl",
  "test_defaultCurrencies",
];
const NOWPAYMENTS_OMITTED_FIELDS = ["ipnUrl", "webhookUrl"];

function createEmptyEnvironment() {
  return PAYMENT_ENVIRONMENT_FIELDS.reduce((result, field) => {
    result[field] = "";
    return result;
  }, {});
}

function createEmptyProviderState() {
  return {
    mode: "test",
    active: false,
    publicKey: "",
    ipnSecretKey: "",
    baseUrl: "",
    defaultCurrencies: "",
    test_publicKey: "",
    test_ipnSecretKey: "",
    test_baseUrl: "",
    test_defaultCurrencies: "",
  };
}

function getEnvironmentForm(form) {
  return form;
}

export default function PaymentMethodsSettingsPage() {
  const { data, loading, error } = useAdminQuery(getAdminPaymentMethods);
  const [feedback, setFeedback] = useState(null);
  const [savingProvider, setSavingProvider] = useState(null);

  // Form state per provider
  const [formState, setFormState] = useState({
    nowpayments: createEmptyProviderState(),
    braintree: createEmptyProviderState(),
    stripe: createEmptyProviderState(),
  });

  const paymentMethods = useMemo(() => data?.items || [], [data?.items]);

  // Initialize form state from data
  useEffect(() => {
    if (paymentMethods.length > 0) {
      setFormState((prev) => {
        const newFormState = { ...prev };
        paymentMethods.forEach((pm) => {
          newFormState[pm.provider] = {
            mode: pm.mode || "test",
            active: pm.active || false,
            apiKey: pm.apiKey || "",
            publicKey: pm.publicKey || "",
            ipnSecretKey: pm.ipnSecretKey || "",
            baseUrl: pm.baseUrl || "",
            defaultCurrencies: pm.defaultCurrencies || "",
            test_apiKey: pm.test_apiKey || "",
            test_publicKey: pm.test_publicKey || "",
            test_ipnSecretKey: pm.test_ipnSecretKey || "",
            test_baseUrl: pm.test_baseUrl || "",
            test_defaultCurrencies: pm.test_defaultCurrencies || "",
          };
        });
        return newFormState;
      });
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

    // Validate required fields based on mode
    const requiredField = form.mode === "test" ? "test_apiKey" : "apiKey";
    if (!form[requiredField]?.trim()) {
      setFeedback({
        type: "error",
        message: `${requiredField} is required for ${provider}.`,
      });
      return;
    }

    setSavingProvider(provider);
    try {
      const response = await updateAdminPaymentMethod(provider, {
        provider,
        mode: form.mode,
        active: form.active,
        apiKey: form.apiKey,
        publicKey: form.publicKey,
        ipnSecretKey: form.ipnSecretKey,
        baseUrl: form.baseUrl,
        defaultCurrencies: form.defaultCurrencies,
        test_apiKey: form.test_apiKey,
        test_publicKey: form.test_publicKey,
        test_ipnSecretKey: form.test_ipnSecretKey,
        test_baseUrl: form.test_baseUrl,
        test_defaultCurrencies: form.test_defaultCurrencies,
      });

      // Update form state with server response to ensure fresh values
      setFormState((prev) => ({
        ...prev,
        [provider]: {
          mode: response.mode || "test",
          active: response.active || false,
          apiKey: response.apiKey || "",
          publicKey: response.publicKey || "",
          ipnSecretKey: response.ipnSecretKey || "",
          baseUrl: response.baseUrl || "",
          defaultCurrencies: response.defaultCurrencies || "",
          test_apiKey: response.test_apiKey || "",
          test_publicKey: response.test_publicKey || "",
          test_ipnSecretKey: response.test_ipnSecretKey || "",
          test_baseUrl: response.test_baseUrl || "",
          test_defaultCurrencies: response.test_defaultCurrencies || "",
        },
      }));

      setFeedback({
        type: "success",
        message: `${provider} payment method updated successfully.`,
      });

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
            form={getEnvironmentForm(formState.nowpayments)}
            isSaving={savingProvider === "nowpayments"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <BraintreeForm
            form={getEnvironmentForm(formState.braintree)}
            isSaving={savingProvider === "braintree"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StripeForm
            form={getEnvironmentForm(formState.stripe)}
            isSaving={savingProvider === "stripe"}
            onUpdateField={updateProviderField}
            onSave={handleSavePaymentMethod}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
