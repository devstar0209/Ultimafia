import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
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
} from "@mui/material";
import { Icon } from "@iconify/react";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminCompetitiveSetups,
  toggleAdminCompetitiveSetup,
  createAdminCompetitiveSetup,
  updateAdminCompetitiveSetup,
  deleteAdminCompetitiveSetup,
} from "../../services/adminService";

export default function CompetitiveSetupsPage() {
  const { data, loading, error, refetch } = useAdminQuery(
    getAdminCompetitiveSetups
  );
  const [setups, setSetups] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (data?.setups) {
      setSetups(data.setups);
    }
  }, [data]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading competitive setups"
        description="Fetching competitive setup data from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Setups unavailable"
        description="The admin panel could not load competitive setups from the backend."
      />
    );
  }

  function openCreateDialog() {
    setEditingSetup(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  }

  function openEditDialog(setup) {
    setEditingSetup(setup);
    setFormData({
      name: setup.name,
      description: setup.description,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSetup(null);
    setFormData({ name: "", description: "" });
  }

  async function handleSaveSetup() {
    if (!formData.name.trim()) {
      setFeedback({
        severity: "error",
        message: "Setup name is required",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingSetup) {
        // Update existing
        const response = await updateAdminCompetitiveSetup(editingSetup.id, {
          name: formData.name,
          description: formData.description,
        });

        setFeedback({
          severity: "success",
          message: `Setup "${response.setup.name}" updated successfully`,
        });

        setSetups((prev) =>
          prev.map((s) =>
            s.id === editingSetup.id
              ? {
                  ...s,
                  name: response.setup.name,
                  description: response.setup.description,
                }
              : s
          )
        );
      } else {
        // Create new
        const response = await createAdminCompetitiveSetup({
          name: formData.name,
          description: formData.description,
        });

        setFeedback({
          severity: "success",
          message: `Setup "${response.setup.name}" created successfully`,
        });

        setSetups([response.setup, ...setups]);
      }

      closeDialog();
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data?.error || "Could not save setup",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSetup(setupId, setupName) {
    setDeleting(setupId);
    setFeedback(null);

    try {
      await deleteAdminCompetitiveSetup(setupId);

      setFeedback({
        severity: "success",
        message: `Setup "${setupName}" deleted successfully`,
      });

      setSetups((prev) => prev.filter((s) => s.id !== setupId));
      setDeleteConfirmOpen(null);
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data?.error || "Could not delete setup",
      });
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleSetup(setupId, currentStatus) {
    setToggling(setupId);
    setFeedback(null);

    try {
      const response = await toggleAdminCompetitiveSetup(setupId);

      setFeedback({
        severity: "success",
        message: response.message,
      });

      // Update local state
      setSetups((prevSetups) =>
        prevSetups.map((setup) =>
          setup.id === setupId
            ? { ...setup, competitive: !currentStatus }
            : setup
        )
      );

      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message:
          err?.response?.data?.error ||
          "Could not update setup status right now.",
      });
    } finally {
      setToggling(null);
    }
  }

  const competitiveCount = setups.filter((s) => s.competitive).length;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {feedback && (
          <Alert severity={feedback.severity}>{feedback.message}</Alert>
        )}

        <SectionCard
          eyebrow="Game Operations"
          title="Competitive Setups"
          subtitle="Manage which setups are available for competitive seasons"
        >
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle2">
                  {setups.length} setup{setups.length !== 1 ? "s" : ""} total
                </Typography>
                <Chip
                  label={`${competitiveCount} approved`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={openCreateDialog}
              >
                New Setup
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#000" }}>
                    <TableCell>Setup Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {setups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No setups found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    setups.map((setup) => (
                      <TableRow key={setup.id}>
                        <TableCell>
                          <strong>{setup.name}</strong>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {setup.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              setup.competitive
                                ? "Approved"
                                : "Not Approved"
                            }
                            color={setup.competitive ? "success" : "default"}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{setup.createdAt}</TableCell>
                        <TableCell>{setup.updatedAt}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              color={setup.competitive ? "error" : "success"}
                              onClick={() =>
                                handleToggleSetup(setup.id, setup.competitive)
                              }
                              disabled={toggling === setup.id}
                              startIcon={
                                toggling === setup.id ? (
                                  <CircularProgress size={16} />
                                ) : setup.competitive ? (
                                  <Icon icon="mdi:close" />
                                ) : (
                                  <Icon icon="mdi:check" />
                                )
                              }
                            >
                              {toggling === setup.id
                                ? "..."
                                : setup.competitive
                                  ? "Remove"
                                  : "Approve"}
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(setup)}
                              title="Edit setup"
                            >
                              <Icon icon="mdi:pencil" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirmOpen(setup)}
                              title="Delete setup"
                            >
                              <Icon icon="mdi:trash-can" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ p: 2, backgroundColor: "#000", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                💡 <strong>Note:</strong> Only approved setups can be used in
                competitive seasons. Use the Approve/Remove buttons to control
                which setups are available for competitive play.
              </Typography>
            </Box>
          </Stack>
        </SectionCard>
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSetup ? "Edit Setup" : "Create New Setup"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Setup Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              fullWidth
              placeholder="e.g., Balanced Setup, Chaos Mode"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              placeholder="Describe the setup rules and mechanics..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={handleSaveSetup}
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : editingSetup ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmOpen)}
        onClose={() => setDeleteConfirmOpen(null)}
        maxWidth="sm"
      >
        <DialogTitle>Delete Setup</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Typography>
              Are you sure you want to delete "{deleteConfirmOpen?.name}"?
            </Typography>
            <Alert severity="warning">
              This action cannot be undone. The setup will be permanently deleted.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(null)}>Cancel</Button>
          <Button
            onClick={() =>
              handleDeleteSetup(deleteConfirmOpen.id, deleteConfirmOpen.name)
            }
            variant="contained"
            color="error"
            disabled={deleting === deleteConfirmOpen?.id}
          >
            {deleting === deleteConfirmOpen?.id ? (
              <CircularProgress size={20} />
            ) : (
              "Delete"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
