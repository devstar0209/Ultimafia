import React, { useEffect, useMemo, useState } from "react";
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
    logoUrl: item?.logoUrl || "",
    logoFile: null,
    logoMarkedForRemoval: false,
  };
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

  useEffect(() => {
    setGameCatalogs(data?.items || []);
  }, [data]);

  const configuredLogoCount = useMemo(
    () => gameCatalogs.filter((item) => Boolean(item.logoUrl)).length,
    [gameCatalogs]
  );
  const hiddenCount = useMemo(
    () => gameCatalogs.filter((item) => Boolean(item.hidden)).length,
    [gameCatalogs]
  );

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

                    return (
                      <Paper
                        key={item.slug || item.key}
                        sx={{
                          p: 2,
                          backgroundColor: item.hidden
                            ? "rgba(255,255,255,0.01)"
                            : "rgba(255,255,255,0.02)",
                          opacity: item.hidden ? 0.72 : 1,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "stretch", md: "center" }}
                          >
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
                                disabled={logoPending || hiddenPending || deletePending}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                color={item.hidden ? "success" : "warning"}
                                onClick={() => handleHideToggle(item)}
                                disabled={logoPending || hiddenPending || deletePending}
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
                                disabled={logoPending || hiddenPending || deletePending}
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
