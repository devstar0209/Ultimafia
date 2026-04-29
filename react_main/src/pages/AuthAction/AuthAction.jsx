import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { applyActionCode, checkActionCode, getAuth } from "firebase/auth";

export default function AuthAction() {
  const location = useLocation();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    if (mode !== "verifyEmail" || !oobCode) {
      setStatus("error");
      setMessage("This verification link is invalid.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const auth = getAuth();
        const actionInfo = await checkActionCode(auth, oobCode);
        const verifiedEmail = actionInfo?.data?.email || "";

        await applyActionCode(auth, oobCode);

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

    verifyEmail();
  }, [location.search]);

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
          <Typography variant="h3">Email Verification</Typography>
          {status === "loading" && <LinearProgress />}
          <Alert severity={status === "success" ? "success" : status === "error" ? "error" : "info"}>
            {message}
          </Alert>
          {email && (
            <Typography color="text.secondary" variant="body2">
              Verified email: {email}
            </Typography>
          )}
          <Button component={Link} to="/welcome" disabled={status === "loading"}>
            Continue to login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
