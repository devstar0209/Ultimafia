import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminRankedTerms,
  updateAdminRankedTerms,
} from "../../services/adminService";

export default function RankedTermsPage() {
  const { data, loading, error } = useAdminQuery(getAdminRankedTerms);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);

  // Disqualification Rules
  const [maxLeaveCount, setMaxLeaveCount] = useState(2);
  const [maxReportCount, setMaxReportCount] = useState(3);
  const [maxBanCount, setMaxBanCount] = useState(1);

  // Timeout Settings
  const [joinGameTimeoutMinutes, setJoinGameTimeoutMinutes] = useState(5);
  const [afkTimeoutMinutes, setAfkTimeoutMinutes] = useState(3);

  // Scoring
  const [winPoints, setWinPoints] = useState(20);
  const [lossPoints, setLossPoints] = useState(0);
  const [drawPoints, setDrawPoints] = useState(10);
  const [afkPenaltyPoints, setAfkPenaltyPoints] = useState(-5);
  const [leavePenaltyPoints, setLeavePenaltyPoints] = useState(-15);

  // Season Requirements
  const [minGamesRequiredPerSeason, setMinGamesRequiredPerSeason] = useState(10);
  const [minWinsRequiredPerSeason, setMinWinsRequiredPerSeason] = useState(5);
  const [seasonResetFrequencyDays, setSeasonResetFrequencyDays] = useState(30);

  // Matchmaking
  const [ratingRangeDifference, setRatingRangeDifference] = useState(200);

  useEffect(() => {
    if (data?.rankedTerms) {
      const terms = data.rankedTerms;
      setMaxLeaveCount(terms.maxLeaveCount ?? 2);
      setMaxReportCount(terms.maxReportCount ?? 3);
      setMaxBanCount(terms.maxBanCount ?? 1);
      setJoinGameTimeoutMinutes(terms.joinGameTimeoutMinutes ?? 5);
      setAfkTimeoutMinutes(terms.afkTimeoutMinutes ?? 3);
      setWinPoints(terms.winPoints ?? 20);
      setLossPoints(terms.lossPoints ?? 0);
      setDrawPoints(terms.drawPoints ?? 10);
      setAfkPenaltyPoints(terms.afkPenaltyPoints ?? -5);
      setLeavePenaltyPoints(terms.leavePenaltyPoints ?? -15);
      setMinGamesRequiredPerSeason(terms.minGamesRequiredPerSeason ?? 10);
      setMinWinsRequiredPerSeason(terms.minWinsRequiredPerSeason ?? 5);
      setSeasonResetFrequencyDays(terms.seasonResetFrequencyDays ?? 30);
      setRatingRangeDifference(terms.ratingRangeDifference ?? 200);
    }
  }, [data]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading ranked terms"
        description="Fetching ranked game term configuration from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Ranked terms unavailable"
        description="The admin panel could not load ranked game term configuration from the backend."
      />
    );
  }

  async function saveRankedTerms() {
    setSaving(true);
    setFeedback(null);

    try {
      await updateAdminRankedTerms({
        maxLeaveCount: Number(maxLeaveCount),
        maxReportCount: Number(maxReportCount),
        maxBanCount: Number(maxBanCount),
        joinGameTimeoutMinutes: Number(joinGameTimeoutMinutes),
        afkTimeoutMinutes: Number(afkTimeoutMinutes),
        winPoints: Number(winPoints),
        lossPoints: Number(lossPoints),
        drawPoints: Number(drawPoints),
        afkPenaltyPoints: Number(afkPenaltyPoints),
        leavePenaltyPoints: Number(leavePenaltyPoints),
        minGamesRequiredPerSeason: Number(minGamesRequiredPerSeason),
        minWinsRequiredPerSeason: Number(minWinsRequiredPerSeason),
        seasonResetFrequencyDays: Number(seasonResetFrequencyDays),
        ratingRangeDifference: Number(ratingRangeDifference),
      });

      setFeedback({
        severity: "success",
        message: "Ranked game terms saved successfully.",
      });
    } catch (err) {
      setFeedback({
        severity: "error",
        message:
          err?.response?.data?.error || "Could not save ranked terms right now.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={8}>
        <Stack spacing={3}>
          {feedback && (
            <Alert severity={feedback.severity}>{feedback.message}</Alert>
          )}

          {/* Disqualification Rules */}
          <SectionCard
            eyebrow="Ranked Rules"
            title="Disqualification Rules"
            subtitle="Conditions that disqualify players from ranked play"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Leave Count"
                  type="number"
                  value={maxLeaveCount}
                  onChange={(e) => setMaxLeaveCount(e.target.value)}
                  inputProps={{ min: 0 }}
                  helperText="Games left before disqualification"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Report Count"
                  type="number"
                  value={maxReportCount}
                  onChange={(e) => setMaxReportCount(e.target.value)}
                  inputProps={{ min: 0 }}
                  helperText="Reports allowed before disqualification"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Ban Count"
                  type="number"
                  value={maxBanCount}
                  onChange={(e) => setMaxBanCount(e.target.value)}
                  inputProps={{ min: 0 }}
                  helperText="Bans allowed before disqualification"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* Timeout Settings */}
          <SectionCard
            eyebrow="Ranked Rules"
            title="Timeout Settings"
            subtitle="Time limits for ranked game actions"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Join Game Timeout"
                  type="number"
                  value={joinGameTimeoutMinutes}
                  onChange={(e) => setJoinGameTimeoutMinutes(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Minutes to join after acceptance"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="AFK Timeout"
                  type="number"
                  value={afkTimeoutMinutes}
                  onChange={(e) => setAfkTimeoutMinutes(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Minutes before marking as AFK"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* Scoring */}
          <SectionCard
            eyebrow="Ranked Rules"
            title="Point Scoring"
            subtitle="Points awarded and deducted for different outcomes"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Win Points"
                  type="number"
                  value={winPoints}
                  onChange={(e) => setWinPoints(e.target.value)}
                  helperText="Points for winning"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Loss Points"
                  type="number"
                  value={lossPoints}
                  onChange={(e) => setLossPoints(e.target.value)}
                  helperText="Points for losing"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Draw Points"
                  type="number"
                  value={drawPoints}
                  onChange={(e) => setDrawPoints(e.target.value)}
                  helperText="Points for draw"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="AFK Penalty"
                  type="number"
                  value={afkPenaltyPoints}
                  onChange={(e) => setAfkPenaltyPoints(e.target.value)}
                  helperText="Penalty for being AFK"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Leave Penalty"
                  type="number"
                  value={leavePenaltyPoints}
                  onChange={(e) => setLeavePenaltyPoints(e.target.value)}
                  helperText="Penalty for leaving"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* Season Requirements */}
          <SectionCard
            eyebrow="Ranked Rules"
            title="Season Requirements"
            subtitle="Minimum participation requirements per season"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Games Per Season"
                  type="number"
                  value={minGamesRequiredPerSeason}
                  onChange={(e) => setMinGamesRequiredPerSeason(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Minimum games to stay active"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Wins Per Season"
                  type="number"
                  value={minWinsRequiredPerSeason}
                  onChange={(e) => setMinWinsRequiredPerSeason(e.target.value)}
                  inputProps={{ min: 0 }}
                  helperText="Minimum wins to maintain rank"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Season Reset Frequency"
                  type="number"
                  value={seasonResetFrequencyDays}
                  onChange={(e) => setSeasonResetFrequencyDays(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Days between season resets"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* Matchmaking */}
          <SectionCard
            eyebrow="Ranked Rules"
            title="Matchmaking"
            subtitle="Settings for player matching in ranked games"
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Rating Range Difference"
                  type="number"
                  value={ratingRangeDifference}
                  onChange={(e) => setRatingRangeDifference(e.target.value)}
                  inputProps={{ min: 0 }}
                  helperText="Max rating difference for matchmaking"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          {/* Save Button */}
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={saveRankedTerms}
              disabled={saving}
            >
              {saving ? <CircularProgress size={20} /> : "Save Ranked Terms"}
            </Button>
          </Box>
        </Stack>
      </Grid>
    </Grid>
  );
}
