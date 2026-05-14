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
import axios from "axios";

export default function DiscordRedirect() {
  const location = useLocation();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Completing Discord sign in...");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      setStatus("error");
      setMessage("Discord sign in was cancelled or denied.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("This Discord sign in link is invalid.");
      return;
    }

    const completeDiscordSignIn = async () => {
      try {
        await axios.post("/api/auth/discord/complete", { code, state });
        setStatus("success");
        setMessage("Discord sign in complete. Redirecting...");
        window.location.replace("/");
      } catch (err) {
        console.error(err);

        const data = err?.response?.data;
        if (data?.siteBanned) {
          const expiresDate = new Date(data.banExpires);
          setMessage(
            `You are site-banned. Your ban expires on ${expiresDate.toLocaleString()}.`
          );
        } else if (data?.deleted) {
          setMessage(
            "Your user is deleted. To restore your account, contact a site administrator."
          );
        } else {
          setMessage(
            "Discord sign in failed. Check your Discord OAuth settings and try again."
          );
        }

        setStatus("error");
      }
    };

    completeDiscordSignIn();
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
          <Typography variant="h3">Discord Sign In</Typography>
          {status === "loading" && <LinearProgress />}
          <Alert severity={status === "error" ? "error" : "info"}>
            {message}
          </Alert>
          {status === "error" && (
            <Button component={Link} to="/welcome">
              Return to login
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
