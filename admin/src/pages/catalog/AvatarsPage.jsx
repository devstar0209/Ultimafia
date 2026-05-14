import React, { useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import {
  createAdminAvatar,
  deleteAdminAvatar,
  getAdminAvatars,
  removeAdminAvatarImage,
  toggleAdminAvatarHidden,
  updateAdminAvatar,
  uploadAdminAvatarImage,
} from "../../services/adminService";

function getLimitLabel(limit) {
  if (limit == null) return "Unlimited";
  if (Number(limit) === 1) return "One-Time";
  return `Limited (${limit})`;
}

export default function AvatarsPage({ search = "" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avatars, setAvatars] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    price: 0,
    currency: "dollar",
    limit: null,
  });

  async function loadAvatars(nextPage = page, nextRowsPerPage = rowsPerPage) {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminAvatars({
        page: nextPage + 1,
        pageSize: nextRowsPerPage,
        search,
      });
      const nextEntries = result?.entries || [];
      const totalPages = Number(result?.pagination?.totalPages || 1);
      if (nextPage >= totalPages && totalPages > 0) {
        setPage(totalPages - 1);
        return;
      }
      setAvatars(nextEntries);
      setTotalRows(Number(result?.pagination?.total || 0));
      if (nextEntries.length > 0) {
        const selectedStillExists = nextEntries.some((avatar) => avatar.key === selectedKey);
        if (!selectedKey || !selectedStillExists) {
          setSelectedKey(nextEntries[0].key);
        }
      } else {
        setSelectedKey("");
      }
    } catch (queryError) {
      setError(queryError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvatars(page, rowsPerPage);
  }, [page, rowsPerPage, search]);

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.key === selectedKey) || null,
    [avatars, selectedKey]
  );
  const editingAvatar = editingKey
    ? avatars.find((avatar) => avatar.key === editingKey) || null
    : null;
  const selectedPreviewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return editingAvatar?.imageUrl || "";
  }, [editingAvatar?.imageUrl, imageFile]);

  useEffect(() => {
    if (!selectedPreviewUrl || !selectedPreviewUrl.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  function openCreateDialog() {
    setEditingKey("");
    setImageFile(null);
    setRemoveImage(false);
    setFormData({
      price: 0,
      currency: "dollar",
      limit: null,
    });
    setDialogOpen(true);
  }

  function openEditDialog(avatar) {
    setEditingKey(avatar.key);
    setImageFile(null);
    setRemoveImage(false);
    setFormData({
      price: Number(avatar.price || 0),
      currency: avatar.currency || "dollar",
      limit: avatar.limit == null ? null : Number(avatar.limit),
    });
    setDialogOpen(true);
  }

  function toAvatarSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildAvatarKeyFromFile(file) {
    const base = toAvatarSlug(file?.name || "");
    const fallback = `avatar-${Date.now()}`;
    if (!base) return fallback;
    const normalized = base.startsWith("avatar-") ? base : `avatar-${base}`;
    return `${normalized}-${Date.now()}`;
  }

  function buildAvatarNameFromFile(file) {
    const base = String(file?.name || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return base || `Avatar ${new Date().toLocaleString()}`;
  }

  async function handleSave() {
    if (!editingKey && !imageFile) {
      setFeedback({ severity: "error", message: "Please choose an avatar image." });
      return;
    }

    setSaving(true);
    try {
      if (editingKey) {
        const updateResponse = await updateAdminAvatar(editingKey, {
          price: Number(formData.price || 0),
          currency: formData.currency,
          limit: formData.limit == null ? null : Number(formData.limit),
        });
        const activeKey = updateResponse?.item?.key || editingKey;
        if (removeImage) {
          await removeAdminAvatarImage(activeKey);
        }
        if (imageFile) {
          await uploadAdminAvatarImage(activeKey, imageFile);
        }
        setFeedback({ severity: "success", message: "Avatar updated." });
      } else {
        const generatedKey = buildAvatarKeyFromFile(imageFile);
        const generatedName = buildAvatarNameFromFile(imageFile);
        const createResponse = await createAdminAvatar({
          key: generatedKey,
          name: generatedName,
          description: "",
          price: Number(formData.price || 0),
          currency: formData.currency,
          limit: formData.limit == null ? null : Number(formData.limit),
        });
        const activeKey = createResponse?.item?.key;
        if (activeKey && imageFile) {
          await uploadAdminAvatarImage(activeKey, imageFile);
        }
        setFeedback({ severity: "success", message: "Avatar created." });
      }
      setDialogOpen(false);
      await loadAvatars(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not save avatar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleHidden(avatar) {
    try {
      await toggleAdminAvatarHidden(avatar.key, !avatar.hidden);
      setFeedback({
        severity: "success",
        message: avatar.hidden ? "Avatar is now visible." : "Avatar hidden.",
      });
      await loadAvatars(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not update visibility.",
      });
    }
  }

  async function handleDelete(avatar) {
    if (!window.confirm(`Delete avatar "${avatar.name}"?`)) return;
    setDeletingKey(avatar.key);
    try {
      await deleteAdminAvatar(avatar.key);
      setFeedback({ severity: "success", message: "Avatar deleted." });
      if (selectedKey === avatar.key) setSelectedKey("");
      await loadAvatars(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not delete avatar.",
      });
    } finally {
      setDeletingKey("");
    }
  }

  if (loading) {
    return (
      <PageFeedback
        title="Loading avatars"
        description="Fetching profile avatar assets and controls from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Avatar catalog unavailable"
        description="The admin panel could not load avatar management data."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
      </Grid>

      <Grid item xs={12}>
        <SectionCard
          eyebrow="Assets"
          title="Avatar Catalog"
          subtitle="Create, update, hide, and delete store avatar items."
        >
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                {totalRows} avatar item{totalRows === 1 ? "" : "s"}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={openCreateDialog}
              >
                Add Avatar
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#000" }}>
                    <TableCell>Avatar</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Limit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {avatars.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No avatars
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    avatars.map((avatar) => (
                      <TableRow
                        key={avatar.key}
                        hover
                        selected={selectedKey === avatar.key}
                        onClick={() => setSelectedKey(avatar.key)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: 1,
                                border: "1px dashed rgba(255,255,255,0.2)",
                                backgroundColor: "rgba(255,255,255,0.04)",
                                backgroundImage: avatar.imageUrl ? `url(${avatar.imageUrl})` : "none",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {avatar.key}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {avatar.currency === "coins"
                            ? `${avatar.price} coins`
                            : `$${Number(avatar.price || 0).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={getLimitLabel(avatar.limit)}
                            color={avatar.limit == null ? "warning" : "default"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={avatar.hidden ? "Hidden" : "Published"}
                            color={avatar.hidden ? "error" : "success"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              title="Edit"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDialog(avatar);
                              }}
                            >
                              <Icon icon="mdi:pencil" />
                            </IconButton>
                            <IconButton
                              size="small"
                              title={avatar.hidden ? "Unhide" : "Hide"}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleHidden(avatar);
                              }}
                            >
                              <Icon icon={avatar.hidden ? "mdi:eye" : "mdi:eye-off"} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              title="Delete"
                              disabled={deletingKey === avatar.key}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(avatar);
                              }}
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
            <TablePagination
              component="div"
              count={totalRows}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </Stack>
        </SectionCard>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingKey ? "Update Avatar" : "Create Avatar"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Button variant="outlined" component="label">
                {imageFile ? `Selected: ${imageFile.name}` : "Choose avatar image"}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setImageFile(file);
                    event.target.value = "";
                  }}
                />
              </Button>
              {editingKey && editingAvatar?.imageUrl ? (
                <Button
                  variant={removeImage ? "contained" : "outlined"}
                  color={removeImage ? "error" : "inherit"}
                  onClick={() => setRemoveImage((prev) => !prev)}
                >
                  {removeImage ? "Will remove current image" : "Remove current image"}
                </Button>
              ) : null}
              <Box
                sx={{
                  width: 140,
                  height: 140,
                  borderRadius: 1,
                  border: "1px dashed rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  backgroundImage: selectedPreviewUrl ? `url(${selectedPreviewUrl})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </Stack>
            <TextField
              label="Price"
              type="number"
              value={formData.price}
              onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Currency"
              select
              value={formData.currency}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, currency: event.target.value }))
              }
            >
              <MenuItem value="dollar">Dollar</MenuItem>
              <MenuItem value="coins">Coins</MenuItem>
            </TextField>
            <TextField
              label="Purchase Limit"
              type="number"
              value={formData.limit === null ? "" : formData.limit}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  limit: event.target.value === "" ? null : event.target.value,
                }))
              }
              inputProps={{ min: 1 }}
              helperText="Leave empty for unlimited, 1 for one-time, or enter a number"
            />
            {editingKey ? (
              <Typography variant="caption" color="text.secondary">
                Editing: {editingAvatar?.name || editingKey}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : editingKey ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
