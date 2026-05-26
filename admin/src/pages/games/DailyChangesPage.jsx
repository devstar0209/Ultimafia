import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  createAdminDailyChange,
  deleteAdminDailyChange,
  getAdminDailyChanges,
  reorderAdminDailyChanges,
  toggleAdminDailyChangeDisabled,
  updateAdminDailyChange,
} from "../../services/adminService";

const extraDataOptions = ["", "Game Type", "Role Name"];

function buildFormState(item) {
  return {
    id: item?.id || "",
    name: item?.name || "",
    tier: item?.tier ?? 1,
    internal: Array.isArray(item?.internal) ? item.internal.join(", ") : "",
    description: item?.description || "",
    extraData: item?.extraData || "",
    reward: item?.reward ?? 0,
    rewardSetting: item?.rewardSetting || "",
    disabled: Boolean(item?.disabled),
  };
}

function moveItem(items, sourceId, targetId) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);

  return nextItems.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export default function DailyChangesPage() {
  const { data, loading, error } = useAdminQuery(getAdminDailyChanges);
  const [dailyChanges, setDailyChanges] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [pendingKey, setPendingKey] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formValues, setFormValues] = useState(buildFormState(null));
  const [draggingId, setDraggingId] = useState("");
  const [dragOverId, setDragOverId] = useState("");

  useEffect(() => {
    setDailyChanges(data?.items || []);
  }, [data]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading daily changes"
        description="Fetching daily challenge definitions from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Daily changes unavailable"
        description="The admin panel could not load daily challenge definitions."
      />
    );
  }

  function applyItemUpdate(updatedItem) {
    setDailyChanges((currentItems) =>
      currentItems
        .map((item) => (item.id === updatedItem.id ? updatedItem : item))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    );
  }

  function openCreateDialog() {
    setEditingItem(null);
    setFormValues(buildFormState(null));
    setDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingItem(item);
    setFormValues(buildFormState(item));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setFormValues(buildFormState(null));
  }

  function updateFormField(prop, value) {
    setFormValues((current) => ({
      ...current,
      [prop]: value,
    }));
  }

  async function handleDrop(sourceId, targetId) {
    const reorderedItems = moveItem(dailyChanges, sourceId, targetId);

    if (reorderedItems === dailyChanges) {
      setDraggingId("");
      setDragOverId("");
      return;
    }

    const previousItems = dailyChanges;
    setDailyChanges(reorderedItems);
    setPendingKey("reorder");
    setFeedback(null);

    try {
      const result = await reorderAdminDailyChanges(
        reorderedItems.map((item) => item.id)
      );
      setDailyChanges(result.items || reorderedItems);
      setFeedback({ severity: "success", message: "Daily change order saved." });
    } catch (reorderError) {
      setDailyChanges(previousItems);
      setFeedback({
        severity: "error",
        message:
          reorderError?.response?.data ||
          "Could not save the daily change order right now.",
      });
    } finally {
      setPendingKey("");
      setDraggingId("");
      setDragOverId("");
    }
  }

  async function handleSubmit() {
    const actionKey = editingItem ? `save:${editingItem.id}` : "create";
    setPendingKey(actionKey);
    setFeedback(null);

    try {
      const payload = {
        id: formValues.id,
        name: formValues.name,
        tier: Number(formValues.tier || 0),
        internal: formValues.internal,
        description: formValues.description,
        extraData: formValues.extraData,
        reward: Number(formValues.reward || 0),
        rewardSetting: formValues.rewardSetting,
        disabled: Boolean(formValues.disabled),
      };

      const result = editingItem
        ? await updateAdminDailyChange(editingItem.id, payload)
        : await createAdminDailyChange(payload);

      if (editingItem) {
        applyItemUpdate(result.item);
      } else {
        setDailyChanges((currentItems) =>
          [...currentItems, result.item].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        );
      }

      setFeedback({
        severity: "success",
        message: editingItem
          ? `${result.item.name} updated.`
          : `${result.item.name} created.`,
      });
      closeDialog();
    } catch (submitError) {
      setFeedback({
        severity: "error",
        message:
          submitError?.response?.data ||
          "Could not save this daily change right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  async function handleDisabledToggle(item) {
    setPendingKey(`disabled:${item.id}`);
    setFeedback(null);

    try {
      const result = await toggleAdminDailyChangeDisabled(
        item.id,
        !item.disabled
      );
      applyItemUpdate(result.item);
      setFeedback({
        severity: "success",
        message: result.item.disabled
          ? `${result.item.name} disabled.`
          : `${result.item.name} enabled.`,
      });
    } catch (toggleError) {
      setFeedback({
        severity: "error",
        message:
          toggleError?.response?.data ||
          "Could not update daily change status right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) {
      return;
    }

    setPendingKey(`delete:${item.id}`);
    setFeedback(null);

    try {
      await deleteAdminDailyChange(item.id);
      setDailyChanges((currentItems) =>
        currentItems.filter((entry) => entry.id !== item.id)
      );
      setFeedback({ severity: "success", message: `${item.name} deleted.` });
    } catch (deleteError) {
      setFeedback({
        severity: "error",
        message:
          deleteError?.response?.data ||
          "Could not delete that daily change right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  const modalPending = Boolean(
    pendingKey === "create" ||
      (editingItem && pendingKey === `save:${editingItem.id}`)
  );
  const reorderPending = pendingKey === "reorder";
  const activeCount = dailyChanges.filter((item) => !item.disabled).length;

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Stack spacing={3}>
            {feedback ? (
              <Alert severity={feedback.severity}>{feedback.message}</Alert>
            ) : null}

            <SectionCard
              eyebrow="Game Operations"
              title="Daily Changes"
              subtitle="Manage the Mongo-backed daily challenge definitions used by refresh jobs, lobby display, and game trackers."
            >
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`${dailyChanges.length} total`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${activeCount} active`}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<Icon icon="solar:add-circle-bold-duotone" />}
                    onClick={openCreateDialog}
                  >
                    Add Daily Change
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {dailyChanges.map((item) => {
                    const statusPending = pendingKey === `disabled:${item.id}`;
                    const deletePending = pendingKey === `delete:${item.id}`;
                    const itemBusy = reorderPending || statusPending || deletePending;
                    const isDragging = draggingId === item.id;
                    const isDragTarget =
                      dragOverId === item.id && draggingId !== item.id;

                    return (
                      <Paper
                        key={item.id}
                        onDragOver={(event) => {
                          if (!draggingId || reorderPending || draggingId === item.id) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverId(item.id);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setDragOverId("");
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceId =
                            event.dataTransfer.getData("text/plain") || draggingId;
                          handleDrop(sourceId, item.id);
                        }}
                        sx={{
                          p: 2,
                          backgroundColor: item.disabled
                            ? "rgba(255,255,255,0.01)"
                            : "rgba(255,255,255,0.02)",
                          border: isDragTarget
                            ? "1px solid rgba(94, 234, 212, 0.65)"
                            : "1px solid rgba(255,255,255,0.08)",
                          opacity: item.disabled || isDragging ? 0.72 : 1,
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          alignItems={{ xs: "stretch", md: "center" }}
                        >
                          <Tooltip title="Drag to reorder">
                            <span>
                              <IconButton
                                aria-label={`Drag ${item.name}`}
                                disabled={Boolean(pendingKey)}
                                draggable={!pendingKey}
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", item.id);
                                  setDraggingId(item.id);
                                }}
                                onDragEnd={() => {
                                  setDraggingId("");
                                  setDragOverId("");
                                }}
                                sx={{
                                  cursor: pendingKey ? "default" : "grab",
                                  alignSelf: { xs: "flex-start", md: "center" },
                                }}
                              >
                                <Icon icon="solar:hamburger-menu-outline" />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mb: 1 }}
                            >
                              <Typography variant="h4">{item.name}</Typography>
                              <Chip
                                size="small"
                                label={item.disabled ? "Disabled" : "Active"}
                                color={item.disabled ? "default" : "success"}
                                variant={item.disabled ? "outlined" : "filled"}
                              />
                              <Chip size="small" label={`Tier ${item.tier}`} />
                              <Typography color="text.secondary" variant="body2">
                                ID: <strong>{item.id}</strong>
                              </Typography>
                              <Typography color="text.secondary" variant="body2">
                                Reward: <strong>{item.reward}</strong>
                              </Typography>
                              {item.rewardSetting ? (
                                <Typography color="text.secondary" variant="body2">
                                  Setting: <strong>{item.rewardSetting}</strong>
                                </Typography>
                              ) : null}
                            </Stack>
                            <Typography color="text.secondary">
                              {item.description}
                            </Typography>
                            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                              Tracker: <strong>{item.internal.join(", ")}</strong>
                              {item.extraData ? ` | Extra data: ${item.extraData}` : ""}
                            </Typography>
                          </Box>

                          <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            justifyContent={{ xs: "flex-start", md: "flex-end" }}
                          >
                            <Button
                              variant="contained"
                              onClick={() => openEditDialog(item)}
                              disabled={itemBusy}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              color={item.disabled ? "success" : "warning"}
                              onClick={() => handleDisabledToggle(item)}
                              disabled={itemBusy}
                            >
                              {statusPending
                                ? "Saving..."
                                : item.disabled
                                  ? "Enable"
                                  : "Disable"}
                            </Button>
                            <IconButton
                              color="error"
                              onClick={() => handleDelete(item)}
                              disabled={itemBusy}
                              aria-label={`Delete ${item.name}`}
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={modalPending ? undefined : closeDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {editingItem ? "Update Daily Change" : "Add Daily Change"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="ID"
                value={formValues.id}
                onChange={(event) => updateFormField("id", event.target.value)}
                disabled={Boolean(editingItem) || modalPending}
                fullWidth
                autoFocus={!editingItem}
              />
              <TextField
                label="Name"
                value={formValues.name}
                onChange={(event) => updateFormField("name", event.target.value)}
                disabled={modalPending}
                fullWidth
                autoFocus={Boolean(editingItem)}
              />
            </Stack>

            <TextField
              label="Description"
              value={formValues.description}
              onChange={(event) =>
                updateFormField("description", event.target.value)
              }
              disabled={modalPending}
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Tier"
                type="number"
                value={formValues.tier}
                onChange={(event) =>
                  updateFormField("tier", Number(event.target.value) || 0)
                }
                disabled={modalPending}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                label="Reward"
                type="number"
                value={formValues.reward}
                onChange={(event) =>
                  updateFormField("reward", Number(event.target.value) || 0)
                }
                disabled={modalPending}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Internal Tracker"
                value={formValues.internal}
                onChange={(event) =>
                  updateFormField("internal", event.target.value)
                }
                disabled={modalPending}
                helperText="Comma-separated Daily class names"
                fullWidth
              />
              <TextField
                select
                label="Extra Data"
                value={formValues.extraData}
                onChange={(event) =>
                  updateFormField("extraData", event.target.value)
                }
                disabled={modalPending}
                fullWidth
              >
                {extraDataOptions.map((option) => (
                  <MenuItem key={option || "none"} value={option}>
                    {option || "None"}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Reward Setting"
              value={formValues.rewardSetting}
              onChange={(event) =>
                updateFormField("rewardSetting", event.target.value)
              }
              disabled={modalPending}
              helperText="Optional DefaultSettings field used as a reward override"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={modalPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={modalPending}
          >
            {modalPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
