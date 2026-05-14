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
  createAdminEmote,
  deleteAdminEmote,
  deleteAdminEmoteItem,
  getAdminEmotes,
  removeAdminEmoteImage,
  toggleAdminEmoteHidden,
  updateAdminEmote,
  uploadAdminEmoteImage,
  uploadAdminEmoteItems,
} from "../../services/adminService";

export default function EmotesPage({ search = "" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emotes, setEmotes] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [emoteFiles, setEmoteFiles] = useState([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [deletingItemId, setDeletingItemId] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    currency: "dollar",
  });

  async function loadEmotes(nextPage = page, nextRowsPerPage = rowsPerPage) {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminEmotes({
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
      setEmotes(nextEntries);
      setTotalRows(Number(result?.pagination?.total || 0));
      if (nextEntries.length > 0) {
        const selectedStillExists = nextEntries.some((emote) => emote.key === selectedKey);
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
    loadEmotes(page, rowsPerPage);
  }, [page, rowsPerPage, search]);

  const editingEmote = editingKey
    ? emotes.find((emote) => emote.key === editingKey) || null
    : null;
  const selectedPreviewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return editingEmote?.iconUrl || editingEmote?.imageUrl || "";
  }, [editingEmote?.iconUrl, editingEmote?.imageUrl, imageFile]);

  useEffect(() => {
    if (!selectedPreviewUrl || !selectedPreviewUrl.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  function openCreateDialog() {
    setEditingKey("");
    setImageFile(null);
    setEmoteFiles([]);
    setRemoveImage(false);
    setFormData({
      name: "",
      price: 0,
      currency: "dollar",
    });
    setDialogOpen(true);
  }

  function openEditDialog(emote) {
    setEditingKey(emote.key);
    setImageFile(null);
    setEmoteFiles([]);
    setRemoveImage(false);
    setFormData({
      name: emote.name || "",
      price: Number(emote.price || 0),
      currency: emote.currency || "dollar",
    });
    setDialogOpen(true);
  }

  function toEmoteSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildEmoteGroupKey(value) {
    const base = toEmoteSlug(value);
    const fallback = `emote-group-${Date.now()}`;
    if (!base) return fallback;
    const normalized = base.startsWith("emote-group-")
      ? base
      : `emote-group-${base.replace(/^emote-/, "")}`;
    return `${normalized}-${Date.now()}`;
  }

  async function handleSave() {
    if (!editingKey && !imageFile) {
      setFeedback({ severity: "error", message: "Please choose a group icon." });
      return;
    }
    if (!formData.name.trim()) {
      setFeedback({ severity: "error", message: "Group name is required." });
      return;
    }
    if (!editingKey && emoteFiles.length === 0) {
      setFeedback({ severity: "error", message: "Please choose at least one emote image." });
      return;
    }

    setSaving(true);
    try {
      if (editingKey) {
        const updateResponse = await updateAdminEmote(editingKey, {
          name: formData.name,
          price: Number(formData.price || 0),
          currency: formData.currency,
        });
        const activeKey = updateResponse?.item?.key || editingKey;
        if (removeImage) {
          await removeAdminEmoteImage(activeKey);
        }
        if (imageFile) {
          await uploadAdminEmoteImage(activeKey, imageFile);
        }
        if (emoteFiles.length > 0) {
          await uploadAdminEmoteItems(activeKey, emoteFiles);
        }
        setFeedback({ severity: "success", message: "Emote group updated." });
      } else {
        const generatedKey = buildEmoteGroupKey(formData.name);
        const createResponse = await createAdminEmote({
          key: generatedKey,
          name: formData.name,
          price: Number(formData.price || 0),
          currency: formData.currency,
        });
        const activeKey = createResponse?.item?.key;
        if (activeKey && imageFile) {
          await uploadAdminEmoteImage(activeKey, imageFile);
        }
        if (activeKey && emoteFiles.length > 0) {
          await uploadAdminEmoteItems(activeKey, emoteFiles);
        }
        setFeedback({ severity: "success", message: "Emote group created." });
      }
      setDialogOpen(false);
      await loadEmotes(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not save emote group.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleHidden(emote) {
    try {
      await toggleAdminEmoteHidden(emote.key, !emote.hidden);
      setFeedback({
        severity: "success",
        message: emote.hidden ? "Emote group is now visible." : "Emote group hidden.",
      });
      await loadEmotes(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not update visibility.",
      });
    }
  }

  async function handleDeleteEmoteItem(group, item) {
    if (!window.confirm(`Delete emote ":${item.name}:" from "${group.name}"?`)) return;
    setDeletingItemId(item.id);
    try {
      const response = await deleteAdminEmoteItem(group.key, item.id);
      const nextGroupEmotes =
        response?.emotes || (group.emotes || []).filter((emote) => emote.id !== item.id);

      setEmotes((prev) =>
        prev.map((emote) =>
          emote.key === group.key ? { ...emote, emotes: nextGroupEmotes } : emote
        )
      );
      setFeedback({ severity: "success", message: "Emote removed from group." });
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not delete emote item.",
      });
    } finally {
      setDeletingItemId("");
    }
  }

  async function handleDelete(emote) {
    if (!window.confirm(`Delete emote group "${emote.name}"?`)) return;
    setDeletingKey(emote.key);
    try {
      await deleteAdminEmote(emote.key);
      setFeedback({ severity: "success", message: "Emote group deleted." });
      if (selectedKey === emote.key) setSelectedKey("");
      await loadEmotes(page, rowsPerPage);
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data || "Could not delete emote group.",
      });
    } finally {
      setDeletingKey("");
    }
  }

  if (loading) {
    return (
      <PageFeedback
        title="Loading emote groups"
        description="Fetching chat emote group assets and controls from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Emote groups unavailable"
        description="The admin panel could not load emote group management data."
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
          title="Emote Groups"
          subtitle="Create priced emote groups and upload multiple chat emotes into each group."
        >
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                {totalRows} emote group{totalRows === 1 ? "" : "s"}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={openCreateDialog}
              >
                Add Group
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#000" }}>
                    <TableCell>Group</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Emotes</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No emote groups
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    emotes.map((emote) => (
                      <TableRow
                        key={emote.key}
                        hover
                        selected={selectedKey === emote.key}
                        onClick={() => setSelectedKey(emote.key)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: 1,
                                border: "1px dashed rgba(255,255,255,0.2)",
                                backgroundColor: "rgba(255,255,255,0.04)",
                                backgroundImage: emote.imageUrl ? `url(${emote.imageUrl})` : "none",
                                backgroundSize: "contain",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                              }}
                            />
                            <Typography variant="body2">{emote.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {emote.key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {(emote.emotes || []).slice(0, 8).map((item) => (
                              <IconButton
                                key={item.id}
                                size="small"
                                title={`Delete :${item.name}:`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteEmoteItem(emote, item);
                                }}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : "none",
                                  backgroundSize: "contain",
                                  backgroundRepeat: "no-repeat",
                                  backgroundPosition: "center",
                                }}
                              />
                            ))}
                            {(emote.emotes || []).length > 8 ? (
                              <Chip size="small" label={`+${emote.emotes.length - 8}`} />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          {emote.currency === "coins"
                            ? `${emote.price} coins`
                            : `$${Number(emote.price || 0).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={emote.hidden ? "Hidden" : "Published"}
                            color={emote.hidden ? "error" : "success"}
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
                                openEditDialog(emote);
                              }}
                            >
                              <Icon icon="mdi:pencil" />
                            </IconButton>
                            <IconButton
                              size="small"
                              title={emote.hidden ? "Unhide" : "Hide"}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleHidden(emote);
                              }}
                            >
                              <Icon icon={emote.hidden ? "mdi:eye" : "mdi:eye-off"} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              title="Delete"
                              disabled={deletingKey === emote.key}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(emote);
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
        <DialogTitle>{editingKey ? "Update Emote Group" : "Create Emote Group"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Group Name"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <Stack spacing={1}>
              <Button variant="outlined" component="label">
                {imageFile ? `Icon: ${imageFile.name}` : "Choose group icon"}
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
              {editingKey && (editingEmote?.iconUrl || editingEmote?.imageUrl) ? (
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
                  width: 100,
                  height: 100,
                  borderRadius: 1,
                  border: "1px dashed rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  backgroundImage: selectedPreviewUrl ? `url(${selectedPreviewUrl})` : "none",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              />
            </Stack>
            <Stack spacing={1}>
              <Button variant="outlined" component="label">
                {emoteFiles.length
                  ? `${emoteFiles.length} emote image${emoteFiles.length === 1 ? "" : "s"} selected`
                  : "Choose emote images"}
                <input
                  hidden
                  multiple
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setEmoteFiles(Array.from(event.target.files || []));
                    event.target.value = "";
                  }}
                />
              </Button>
              {emoteFiles.length ? (
                <Typography variant="caption" color="text.secondary">
                  {emoteFiles.map((file) => file.name).join(", ")}
                </Typography>
              ) : null}
            </Stack>
            {editingKey ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Emotes</Typography>
                {(editingEmote?.emotes || []).length ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
                      gap: 1,
                    }}
                  >
                    {(editingEmote?.emotes || []).map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          position: "relative",
                          minHeight: 88,
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 1,
                          backgroundColor: "rgba(255,255,255,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          p: 1,
                        }}
                      >
                        <Box
                          component="img"
                          src={item.imageUrl}
                          alt={`:${item.name}:`}
                          sx={{
                            width: 42,
                            height: 42,
                            objectFit: "contain",
                          }}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          title={`Delete :${item.name}:`}
                          disabled={deletingItemId === item.id}
                          onClick={() => handleDeleteEmoteItem(editingEmote, item)}
                          sx={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            backgroundColor: "rgba(0,0,0,0.72)",
                            "&:hover": {
                              backgroundColor: "rgba(0,0,0,0.9)",
                            },
                          }}
                        >
                          <Icon icon="mdi:trash-can" />
                        </IconButton>
                        <Typography
                          variant="caption"
                          title={`:${item.name}:`}
                          sx={{
                            position: "absolute",
                            left: 6,
                            right: 6,
                            bottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textAlign: "center",
                          }}
                        >
                          :{item.name}:
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No emotes in this group.
                  </Typography>
                )}
              </Stack>
            ) : null}
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
            {editingKey ? (
              <Typography variant="caption" color="text.secondary">
                Editing: {editingEmote?.name || editingKey}
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
