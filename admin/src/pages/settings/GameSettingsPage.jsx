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
  createAdminManagedGameCatalog,
  deleteAdminManagedGameCatalog,
  getAdminManagedGameCatalogs,
  removeAdminManagedGameCatalogLogo,
  reorderAdminManagedGameCatalogs,
  toggleAdminManagedGameCatalogHidden,
  updateAdminManagedGameCatalog,
  uploadAdminManagedGameCatalogLogo,
} from "../../services/adminService";

function slugifyValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildModalState(item) {
  return {
    key: item?.key || "",
    title: item?.title || "",
    slug: item?.slug || "",
    coins: item?.coins || 0,
    pointsFinishGame: item?.pointsFinishGame ?? 20,
    pointsWin: item?.pointsWin ?? 25,
    pointsCorrectVote: item?.pointsCorrectVote ?? 10,
    pointsRoleSuccess: item?.pointsRoleSuccess ?? 15,
    logoUrl: item?.logoUrl || "",
    logoFile: null,
    logoMarkedForRemoval: false,
  };
}

function isMafiaCatalog(item) {
  return ["key", "title", "slug"].some(
    (prop) => String(item?.[prop] || "").toLowerCase() === "mafia"
  );
}

function moveCatalogItem(items, sourceKey, targetKey) {
  const sourceIndex = items.findIndex((item) => item.key === sourceKey);
  const targetIndex = items.findIndex((item) => item.key === targetKey);

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

export default function GameCatalogSettingsPage() {
  const { data, loading, error } = useAdminQuery(getAdminManagedGameCatalogs);
  const [gameCatalogs, setGameCatalogs] = useState([]);
  const [pendingKey, setPendingKey] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalValues, setModalValues] = useState(buildModalState(null));
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [draggingKey, setDraggingKey] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");

  useEffect(() => {
    setGameCatalogs(data?.items || []);
  }, [data]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading game catalogs"
        description="Fetching the managed game catalog entries from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Game catalogs unavailable"
        description="The admin panel could not load managed game catalogs from the backend."
      />
    );
  }

  function applyItemUpdate(updatedItem) {
    setGameCatalogs((currentItems) =>
      currentItems
        .map((item) => (item.key === updatedItem.key ? updatedItem : item))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    );
  }

  function openCreateModal() {
    setEditingItem(null);
    setModalValues(buildModalState(null));
    setLogoPreviewUrl("");
    setSlugTouched(false);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setModalValues(buildModalState(item));
    setLogoPreviewUrl(item?.logoUrl || "");
    setSlugTouched(true);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setModalValues(buildModalState(null));
    setSlugTouched(false);
    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl("");
  }

  function updateModalField(prop, value) {
    setModalValues((current) => {
      const nextValues = {
        ...current,
        [prop]: value,
      };

      if (prop === "title" && !slugTouched) {
        nextValues.slug = slugifyValue(value);
      }

      return nextValues;
    });
  }

  async function handleCatalogDrop(sourceKey, targetKey) {
    const reorderedItems = moveCatalogItem(gameCatalogs, sourceKey, targetKey);

    if (reorderedItems === gameCatalogs) {
      setDraggingKey("");
      setDragOverKey("");
      return;
    }

    const previousItems = gameCatalogs;
    setGameCatalogs(reorderedItems);
    setPendingKey("reorder");
    setFeedback(null);

    try {
      const result = await reorderAdminManagedGameCatalogs(
        reorderedItems.map((item) => item.key)
      );
      setGameCatalogs(result.items || reorderedItems);
      setFeedback({
        severity: "success",
        message: "Game catalog order saved.",
      });
    } catch (reorderError) {
      setGameCatalogs(previousItems);
      setFeedback({
        severity: "error",
        message:
          reorderError?.response?.data ||
          "Could not save the game catalog order right now.",
      });
    } finally {
      setPendingKey("");
      setDraggingKey("");
      setDragOverKey("");
    }
  }

  function handleModalLogoFileSelect(file) {
    if (!file) {
      return;
    }

    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setModalValues((current) => ({
      ...current,
      logoFile: file,
      logoMarkedForRemoval: false,
    }));
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  function handleModalLogoRemove() {
    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setModalValues((current) => ({
      ...current,
      logoFile: null,
      logoMarkedForRemoval: Boolean(current.logoUrl),
    }));
    setLogoPreviewUrl("");
  }

  async function handleModalSubmit() {
    const actionKey = editingItem ? `save:${editingItem.key}` : "create";
    setPendingKey(actionKey);
    setFeedback(null);

    try {
      const payload = {
        title: modalValues.title,
        slug: modalValues.slug,
        coins: Number(modalValues.coins || 0),
      };

      if (editingItem && isMafiaCatalog(editingItem)) {
        payload.pointsFinishGame = Number(modalValues.pointsFinishGame || 0);
        payload.pointsWin = Number(modalValues.pointsWin || 0);
        payload.pointsCorrectVote = Number(modalValues.pointsCorrectVote || 0);
        payload.pointsRoleSuccess = Number(modalValues.pointsRoleSuccess || 0);
      }

      let result = editingItem
        ? await updateAdminManagedGameCatalog(editingItem.key, payload)
        : await createAdminManagedGameCatalog(payload);

      if (modalValues.logoMarkedForRemoval && editingItem) {
        const removeResult = await removeAdminManagedGameCatalogLogo(editingItem.key);
        result = removeResult;
      } else if (modalValues.logoFile) {
        const targetKey = editingItem ? editingItem.key : result.item.key;
        const uploadResult = await uploadAdminManagedGameCatalogLogo(
          targetKey,
          modalValues.logoFile
        );
        result = uploadResult;
      }

      if (editingItem) {
        applyItemUpdate(result.item);
      } else {
        setGameCatalogs((currentItems) =>
          [...currentItems, result.item].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        );
      }

      setFeedback({
        severity: "success",
        message: editingItem
          ? `${result.item.title} updated.`
          : `${result.item.title} created.`,
      });
      closeModal();
    } catch (submitError) {
      setFeedback({
        severity: "error",
        message:
          submitError?.response?.data ||
          "Could not save this game catalog right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  async function handleHideToggle(item) {
    setPendingKey(`hidden:${item.key}`);
    setFeedback(null);

    try {
      const result = await toggleAdminManagedGameCatalogHidden(
        item.key,
        !item.hidden
      );
      applyItemUpdate(result.item);
      setFeedback({
        severity: "success",
        message: result.item.hidden
          ? `${result.item.title} hidden.`
          : `${result.item.title} shown.`,
      });
    } catch (toggleError) {
      setFeedback({
        severity: "error",
        message:
          toggleError?.response?.data ||
          "Could not update visibility right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  async function handleDelete(item) {
    if (
      !window.confirm(
        `Delete "${item.title}"? This will remove the catalog entry and its uploaded logo.`
      )
    ) {
      return;
    }

    setPendingKey(`delete:${item.key}`);
    setFeedback(null);

    try {
      await deleteAdminManagedGameCatalog(item.key);
      setGameCatalogs((currentItems) =>
        currentItems.filter((entry) => entry.key !== item.key)
      );
      setFeedback({
        severity: "success",
        message: `${item.title} deleted.`,
      });
    } catch (deleteError) {
      setFeedback({
        severity: "error",
        message:
          deleteError?.response?.data ||
          "Could not delete that game catalog right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  const modalPending = Boolean(
    pendingKey === "create" ||
      (editingItem && pendingKey === `save:${editingItem.key}`)
  );
  const reorderPending = pendingKey === "reorder";
  const showMafiaPointOptions = Boolean(editingItem && isMafiaCatalog(editingItem));

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Stack spacing={3}>
            {feedback ? (
              <Alert severity={feedback.severity}>{feedback.message}</Alert>
            ) : null}
            <SectionCard
              eyebrow="Game Catalog"
              title="Game Catalogs"
              subtitle="Manage catalog entries as a list, with modal-based create and edit flows."
            >
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography color="text.secondary">
                    {gameCatalogs.length} entries
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Icon icon="solar:add-circle-bold-duotone" />}
                    onClick={openCreateModal}
                  >
                    Add Game Catalog
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {gameCatalogs.map((item) => {
                    const logoPending = pendingKey === `logo:${item.key}`;
                    const hiddenPending = pendingKey === `hidden:${item.key}`;
                    const deletePending = pendingKey === `delete:${item.key}`;
                    const itemBusy =
                      reorderPending || logoPending || hiddenPending || deletePending;
                    const isDragging = draggingKey === item.key;
                    const isDragTarget =
                      dragOverKey === item.key && draggingKey !== item.key;

                    return (
                      <Paper
                        key={item.slug || item.key}
                        onDragOver={(event) => {
                          if (!draggingKey || reorderPending || draggingKey === item.key) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverKey(item.key);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setDragOverKey("");
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceKey =
                            event.dataTransfer.getData("text/plain") || draggingKey;
                          handleCatalogDrop(sourceKey, item.key);
                        }}
                        sx={{
                          p: 2,
                          backgroundColor: item.hidden
                            ? "rgba(255,255,255,0.01)"
                            : "rgba(255,255,255,0.02)",
                          border: isDragTarget
                            ? "1px solid rgba(94, 234, 212, 0.65)"
                            : "1px solid rgba(255,255,255,0.08)",
                          opacity: item.hidden || isDragging ? 0.72 : 1,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "stretch", md: "center" }}
                          >
                            <Tooltip title="Drag to reorder">
                              <span>
                                <IconButton
                                  aria-label={`Drag ${item.title}`}
                                  disabled={Boolean(pendingKey)}
                                  draggable={!pendingKey}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", item.key);
                                    setDraggingKey(item.key);
                                  }}
                                  onDragEnd={() => {
                                    setDraggingKey("");
                                    setDragOverKey("");
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

                            <Box
                              sx={{
                                width: 84,
                                height: 84,
                                borderRadius: 2,
                                border: "1px dashed rgba(255,255,255,0.12)",
                                backgroundColor: "rgba(255,255,255,0.02)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                flexShrink: 0,
                              }}
                            >
                              {item.logoUrl ? (
                                <Box
                                  component="img"
                                  src={item.logoUrl}
                                  alt={`${item.title} logo`}
                                  sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                  }}
                                />
                              ) : (
                                <Icon
                                  icon="solar:gallery-wide-bold-duotone"
                                  style={{ fontSize: 28, opacity: 0.5 }}
                                />
                              )}
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                                sx={{ mb: 1 }}
                              >
                                <Typography variant="h4">{item.title}</Typography>
                                <Chip
                                  size="small"
                                  label={item.hidden ? "Hidden" : "Visible"}
                                  color={item.hidden ? "default" : "success"}
                                  variant={item.hidden ? "outlined" : "filled"}
                                />
                                <Typography color="text.secondary" variant="body2">
                                  Slug: <strong>{item.slug}</strong>
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                  Coins: <strong>{item.coins || 0}</strong>
                                </Typography>
                                {isMafiaCatalog(item) && (
                                  <Typography color="text.secondary" variant="body2">
                                    Points:{" "}
                                    <strong>
                                      finish {item.pointsFinishGame ?? 20}, win{" "}
                                      {item.pointsWin ?? 25}, vote{" "}
                                      {item.pointsCorrectVote ?? 10}, role{" "}
                                      {item.pointsRoleSuccess ?? 15}
                                    </strong>
                                  </Typography>
                                )}
                              </Stack>
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
                                onClick={() => openEditModal(item)}
                                disabled={itemBusy}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                color={item.hidden ? "success" : "warning"}
                                onClick={() => handleHideToggle(item)}
                                disabled={itemBusy}
                              >
                                {hiddenPending
                                  ? "Saving..."
                                  : item.hidden
                                    ? "Show"
                                    : "Hide"}
                              </Button>
                              <IconButton
                                color="error"
                                onClick={() => handleDelete(item)}
                                disabled={itemBusy}
                                aria-label={`Delete ${item.title}`}
                              >
                                <Icon icon="solar:trash-bin-trash-bold-duotone" />
                              </IconButton>
                            </Stack>
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

      <Dialog open={modalOpen} onClose={modalPending ? undefined : closeModal} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingItem ? "Update Game Catalog" : "Add Game Catalog"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Title"
                value={modalValues.title}
                onChange={(event) => updateModalField("title", event.target.value)}
                disabled={modalPending}
                fullWidth
                autoFocus
              />
              <TextField
                label="Slug"
                value={modalValues.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  updateModalField("slug", event.target.value);
                }}
                helperText="Lowercase URL slug. The backend normalizes this value."
                disabled={editingItem ? true : modalPending}
                fullWidth
              />
            </Stack>

            <TextField
              label="Coins Required"
              type="number"
              value={modalValues.coins}
              onChange={(event) =>
                updateModalField("coins", Number(event.target.value) || 0)
              }
              disabled={modalPending}
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              helperText="Coins deducted from player balance when starting this game"
            />

            {showMafiaPointOptions && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Finish Game Points"
                    type="number"
                    value={modalValues.pointsFinishGame}
                    onChange={(event) =>
                      updateModalField(
                        "pointsFinishGame",
                        Number(event.target.value) || 0
                      )
                    }
                    disabled={modalPending}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Win Points"
                    type="number"
                    value={modalValues.pointsWin}
                    onChange={(event) =>
                      updateModalField("pointsWin", Number(event.target.value) || 0)
                    }
                    disabled={modalPending}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Correct Vote Points"
                    type="number"
                    value={modalValues.pointsCorrectVote}
                    onChange={(event) =>
                      updateModalField(
                        "pointsCorrectVote",
                        Number(event.target.value) || 0
                      )
                    }
                    disabled={modalPending}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Role Success Points"
                    type="number"
                    value={modalValues.pointsRoleSuccess}
                    onChange={(event) =>
                      updateModalField(
                        "pointsRoleSuccess",
                        Number(event.target.value) || 0
                      )
                    }
                    disabled={modalPending}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
              </Grid>
            )}

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  minWidth: 112,
                  width: 112,
                  borderRadius: 2,
                  border: "1px dashed rgba(255,255,255,0.12)",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  p: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 84,
                    height: 84,
                    borderRadius: 2,
                    backgroundColor: "rgba(255,255,255,0.02)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {logoPreviewUrl ? (
                    <Box
                      component="img"
                      src={logoPreviewUrl}
                      alt="Selected logo preview"
                      sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <Icon
                      icon="solar:gallery-wide-bold-duotone"
                      style={{ fontSize: 28, opacity: 0.5 }}
                    />
                  )}
                </Box>
              </Box>

              <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Button
                  variant="outlined"
                  component="label"
                  disabled={modalPending}
                >
                  {modalValues.logoFile ? "Replace Logo" : "Upload Logo"}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      handleModalLogoFileSelect(file);
                    }}
                  />
                </Button>
                {(modalValues.logoUrl || modalValues.logoFile) && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={handleModalLogoRemove}
                    disabled={modalPending}
                  >
                    Remove Logo
                  </Button>
                )}
                {modalValues.logoFile ? (
                  <Typography variant="caption" sx={{ textAlign: "center" }}>
                    {modalValues.logoFile.name}
                  </Typography>
                ) : null}
                <Typography color="text.secondary" variant="body2">
                  Add or replace the catalog logo here. The logo is saved when the catalog entry is created or updated.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} disabled={modalPending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleModalSubmit} disabled={modalPending}>
            {modalPending
              ? editingItem
                ? "Saving..."
                : "Creating..."
              : editingItem
                ? "Save Changes"
                : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
