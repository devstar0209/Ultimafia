import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Chip,
} from "@mui/material";
import { Icon } from "@iconify/react";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminCompetitiveSeasons,
  createAdminCompetitiveSeason,
  pauseAdminCompetitiveSeason,
} from "../../services/adminService";

export default function CompetitiveSeasonsPage() {
  const { data, loading, error, refetch } = useAdminQuery(
    getAdminCompetitiveSeasons
  );
  const [seasons, setSeasons] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pausing, setPausing] = useState(null);

  // Dialog state
  const [startDate, setStartDate] = useState("");
  const [numRounds, setNumRounds] = useState(3);
  const [setupsPerRound, setSetupsPerRound] = useState(3);

  useEffect(() => {
    if (data?.seasons) {
      setSeasons(data.seasons);
    }
  }, [data]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading competitive seasons"
        description="Fetching competitive season data from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Seasons unavailable"
        description="The admin panel could not load competitive seasons from the backend."
      />
    );
  }

  async function handleCreateSeason() {
    if (!startDate) {
      setFeedback({
        severity: "error",
        message: "Start date is required (format: YYYY-MM-DD)",
      });
      return;
    }

    setCreating(true);
    setFeedback(null);

    try {
      await createAdminCompetitiveSeason({
        startDate,
        numRounds: Number(numRounds),
        setupsPerRound: Number(setupsPerRound),
      });

      setFeedback({
        severity: "success",
        message: "Competitive season created successfully.",
      });

      setStartDate("");
      setNumRounds(3);
      setSetupsPerRound(3);
      setDialogOpen(false);
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data?.error || "Could not create season right now.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handlePauseSeason(seasonNumber) {
    setPausing(seasonNumber);
    setFeedback(null);

    try {
      await pauseAdminCompetitiveSeason(seasonNumber);
      setFeedback({
        severity: "success",
        message: `Season ${seasonNumber} state toggled.`,
      });
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message:
          err?.response?.data?.error || "Could not toggle season state right now.",
      });
    } finally {
      setPausing(null);
    }
  }

  function getStatusColor(status) {
    if (status === "Active") return "success";
    if (status === "Paused") return "warning";
    return "default";
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}

        <SectionCard
          eyebrow="Game Operations"
          title="Competitive Seasons"
          subtitle="Create and manage competitive seasons"
        >
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                {seasons.length} season{seasons.length !== 1 ? "s" : ""}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={() => setDialogOpen(true)}
              >
                New Season
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#000" }}>
                    <TableCell>Season #</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>Rounds</TableCell>
                    <TableCell>Setups/Round</TableCell>
                    <TableCell>Current Round</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seasons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No seasons created yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    seasons.map((season) => (
                      <TableRow key={season.number}>
                        <TableCell>
                          <strong>#{season.number}</strong>
                        </TableCell>
                        <TableCell>
                          {new Date(season.startDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{season.numRounds}</TableCell>
                        <TableCell>{season.setupsPerRound || "—"}</TableCell>
                        <TableCell>{season.currentRound || "—"}</TableCell>
                        <TableCell>
                          <Chip
                            label={season.status}
                            color={getStatusColor(season.status)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {season.status !== "Completed" && (
                            <Button
                              size="small"
                              onClick={() => handlePauseSeason(season.number)}
                              disabled={pausing === season.number}
                            >
                              {pausing === season.number ? (
                                <CircularProgress size={20} />
                              ) : season.paused ? (
                                "Resume"
                              ) : (
                                "Pause"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </SectionCard>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Competitive Season</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              helperText="Format: YYYY-MM-DD"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Number of Rounds"
              type="number"
              value={numRounds}
              onChange={(e) => setNumRounds(e.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
            />
            <TextField
              label="Setups Per Round"
              type="number"
              value={setupsPerRound}
              onChange={(e) => setSetupsPerRound(e.target.value)}
              helperText="Number of different setups played in each round"
              inputProps={{ min: 1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSeason}
            variant="contained"
            disabled={creating}
          >
            {creating ? <CircularProgress size={20} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
