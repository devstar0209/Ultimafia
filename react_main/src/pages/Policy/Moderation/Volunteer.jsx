import React, { useState, useContext } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import { useErrorAlert } from "components/Alerts";
import { UserContext, SiteInfoContext } from "Contexts";

export default function Volunteer() {
  const [age, setAge] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();

  const handleSubmit = async () => {
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 100) {
      siteInfo.showAlert("Please provide a valid age.", "error");
      return;
    }
    if (!reason.trim()) {
      siteInfo.showAlert(
        "Please explain why you want to be an Admin on PassionMafia.",
        "error"
      );
      return;
    }

    try {
      setSubmitting(true);
      await axios.post("/api/report/volunteer", {
        age: ageNum,
        reason: reason.trim(),
      });

      siteInfo.showAlert(
        "Your application has been submitted successfully.",
        "success"
      );
      setAge("");
      setReason("");
    } catch (e) {
      if (e?.response?.data) {
        siteInfo.showAlert(e.response.data.toString(), "error");
      } else {
        errorAlert(e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Typography variant="h3" gutterBottom>
        Volunteer
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Interested in joining the PassionMafia staff team? Fill out the form
        below to submit your application.
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 560 }}>
        <Stack spacing={2}>
          <TextField
            label="Age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            fullWidth
            inputProps={{ min: 13, max: 100 }}
            disabled={!user.loggedIn || submitting}
          />
          <TextField
            label="Why do you want to help lead PassionMafia?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            rows={6}
            placeholder="Explain what you can bring to PassionMafia's leadership..."
            disabled={!user.loggedIn || submitting}
            inputProps={{ maxLength: 1500 }}
            helperText={`${reason.length}/1500 characters`}
          />
          {user.loggedIn ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !age.trim() || !reason.trim()}
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          ) : (
            <Typography color="text.secondary">
              You must be logged in to submit an application.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
