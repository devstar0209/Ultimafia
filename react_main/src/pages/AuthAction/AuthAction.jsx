import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  getAuth,
  verifyPasswordResetCode,
} from "firebase/auth";

export default function AuthAction() {
  const location = useLocation();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState("");
  const [oobCode, setOobCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const actionMode = params.get("mode");
    const actionCode = params.get("oobCode");

    setMode(actionMode || "");
    setOobCode(actionCode || "");
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");

    if (!actionCode) {
      setStatus("error");
      setMessage("This account action link is invalid.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const auth = getAuth();
        const actionInfo = await checkActionCode(auth, actionCode);
        const verifiedEmail = actionInfo?.data?.email || "";

        await applyActionCode(auth, actionCode);

        setEmail(verifiedEmail);
        setStatus("success");
        setMessage("Email verified. You can now log in.");
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage(
          "This verification link is expired or has already been used. Please request a new verification email."
        );
      }
    };

    const verifyPasswordReset = async () => {
      try {
        setStatus("loading");
        setMessage("Checking your password reset link...");

        const auth = getAuth();
        const resetEmail = await verifyPasswordResetCode(auth, actionCode);

        setEmail(resetEmail || "");
        setStatus("ready");
        setMessage("Choose a new password for your account.");
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage(
          "This password reset link is expired or has already been used. Please request a new password reset email."
        );
      }
    };

    if (actionMode === "verifyEmail") {
      setStatus("loading");
      setMessage("Verifying your email...");
      verifyEmail();
      return;
    }

    if (actionMode === "resetPassword") {
      verifyPasswordReset();
      return;
    }

    setStatus("error");
    setMessage("This account action link is not supported.");
  }, [location.search]);

  const isResetPassword = mode === "resetPassword";
  const isPasswordTooShort = password.length > 0 && password.length < 6;
  const passwordsDiffer =
    passwordConfirmation.length > 0 && password !== passwordConfirmation;
  const canResetPassword =
    status === "ready" &&
    password.length >= 6 &&
    password === passwordConfirmation &&
    Boolean(oobCode);

  const getAlertSeverity = () => {
    if (status === "success") return "success";
    if (status === "error") return "error";
    return "info";
  };

  const resetPassword = async (e) => {
    e.preventDefault();

    if (!canResetPassword) return;

    try {
      setStatus("submitting");
      setMessage("Updating your password...");

      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode, password);

      setPassword("");
      setPasswordConfirmation("");
      setStatus("success");
      setMessage("Password updated. You can now log in with your new password.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(
        "This password reset link is expired or has already been used. Please request a new password reset email."
      );
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: 8,
      }}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 460,
          p: 3,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h3">
            {isResetPassword ? "Reset Password" : "Email Verification"}
          </Typography>
          {(status === "loading" || status === "submitting") && (
            <LinearProgress />
          )}
          <Alert severity={getAlertSeverity()}>
            {message}
          </Alert>
          {email && (
            <Typography color="text.secondary" variant="body2">
              {isResetPassword ? "Account email" : "Verified email"}: {email}
            </Typography>
          )}
          {isResetPassword && (status === "ready" || status === "submitting") && (
            <Box component="form" onSubmit={resetPassword}>
              <Stack spacing={2}>
                <TextField
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={isPasswordTooShort}
                  helperText={
                    isPasswordTooShort ? "Password must be at least 6 characters." : ""
                  }
                  disabled={status === "submitting"}
                  fullWidth
                />
                <TextField
                  label="Confirm New Password"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  error={passwordsDiffer}
                  helperText={passwordsDiffer ? "Passwords differ." : ""}
                  disabled={status === "submitting"}
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canResetPassword || status === "submitting"}
                >
                  Update Password
                </Button>
              </Stack>
            </Box>
          )}
          <Button
            component={Link}
            to="/welcome"
            disabled={status === "loading" || status === "submitting"}
          >
            Continue to login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
