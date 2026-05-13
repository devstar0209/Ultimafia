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
  FormControlLabel,
  MenuItem,
  Switch,
} from "@mui/material";
import { Icon } from "@iconify/react";

import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminShopItems,
  createAdminShopItem,
  updateAdminShopItem,
  uploadAdminShopItemImage,
  removeAdminShopItemImage,
  deleteAdminShopItem,
} from "../../services/adminService";

function getShopItemType(key) {
  const keyLower = String(key || "").toLowerCase();

  if (keyLower.includes("color") || keyLower.includes("profile") || keyLower.includes("icon")) {
    return "Customization";
  }

  if (keyLower.includes("name")) {
    return "Identity";
  }

  if (keyLower.includes("stamp")) {
    return "Collectible";
  }

  if (keyLower.includes("family")) {
    return "Community";
  }

  return "Utility";
}

function getStatusLabel(limit) {
  if (limit == null) return "Unlimited";
  if (limit === 1) return "One-Time";
  return `Limited (${limit})`;
}

function formatPrice(item) {
  if (item.currency === "dollar") {
    return `$${Number(item.price || 0).toFixed(2)}`;
  }
  return `${Number(item.price || 0)} coins`;
}

export default function PriceItemsPage() {
  const { data, loading, error, refetch } = useAdminQuery(getAdminShopItems);
  const [items, setItems] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    description: "",
    price: 0,
    currency: "coins",
    limit: null,
    hidden: false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (data?.items) {
      setItems(data.items);
    }
  }, [data]);

  const imagePreviewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    if (removeImage) return "";
    return editingItem?.imageUrl || "";
  }, [editingItem?.imageUrl, imageFile, removeImage]);

  useEffect(() => {
    if (!imagePreviewUrl || !imagePreviewUrl.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  if (loading) {
    return (
      <PageFeedback
        title="Loading price items"
        description="Fetching the shop item configuration from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Price items unavailable"
        description="The admin panel could not load shop item configuration from the backend."
      />
    );
  }

  function openCreateDialog() {
    setEditingItem(null);
    setFormData({
      key: "",
      name: "",
      description: "",
      price: 0,
      currency: "coins",
      limit: null,
      hidden: false,
    });
    setImageFile(null);
    setRemoveImage(false);
    setDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingItem(item);
    setFormData({
      key: item.key,
      name: item.name,
      description: item.description || "",
      price: item.price,
      currency: item.currency || "coins",
      limit: item.limit,
      hidden: item.hidden || false,
    });
    setImageFile(null);
    setRemoveImage(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      key: "",
      name: "",
      description: "",
      price: 0,
      currency: "coins",
      limit: null,
      hidden: false,
    });
    setImageFile(null);
    setRemoveImage(false);
  }

  async function handleSaveItem() {
    if (!formData.name.trim()) {
      setFeedback({ severity: "error", message: "Item name is required" });
      return;
    }

    if (!formData.key.trim() && !editingItem) {
      setFeedback({ severity: "error", message: "Item key is required" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingItem) {
        // Update existing
        const response = await updateAdminShopItem(editingItem.id, {
          name: formData.name,
          description: formData.description,
          price: Number(formData.price || 0),
          currency: formData.currency,
          limit: formData.limit == null ? null : Number(formData.limit),
          hidden: Boolean(formData.hidden),
        });

        const activeItemId = response.item.id || editingItem.id;
        if (removeImage && !imageFile) {
          await removeAdminShopItemImage(activeItemId);
        }
        if (imageFile) {
          await uploadAdminShopItemImage(activeItemId, imageFile);
        }

        setFeedback({
          severity: "success",
          message: `"${response.item.name}" updated successfully`,
        });

        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? {
                  ...item,
                  name: response.item.name,
                  description: response.item.description,
                  price: response.item.price,
                  currency: response.item.currency,
                  limit: response.item.limit,
                  hidden: response.item.hidden,
                }
              : item
          )
        );
      } else {
        // Create new
        const response = await createAdminShopItem({
          key: formData.key,
          name: formData.name,
          description: formData.description,
          price: Number(formData.price || 0),
          currency: formData.currency,
          limit: formData.limit == null ? null : Number(formData.limit),
          hidden: Boolean(formData.hidden),
        });

        if (imageFile && response.item.id) {
          await uploadAdminShopItemImage(response.item.id, imageFile);
        }

        setFeedback({
          severity: "success",
          message: `"${response.item.name}" created successfully`,
        });

        setItems([...items, response.item]);
      }

      closeDialog();
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data?.error || "Could not save item",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteItem(itemId, itemName) {
    setDeleting(itemId);
    setFeedback(null);

    try {
      await deleteAdminShopItem(itemId);

      setFeedback({
        severity: "success",
        message: `"${itemName}" deleted successfully`,
      });

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setDeleteConfirmOpen(null);
      refetch();
    } catch (err) {
      setFeedback({
        severity: "error",
        message: err?.response?.data?.error || "Could not delete item",
      });
    } finally {
      setDeleting(null);
    }
  }

  const totalCoinValue = items
    .filter((item) => item.currency !== "dollar")
    .reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalDollarValue = items
    .filter((item) => item.currency === "dollar")
    .reduce((sum, item) => sum + Number(item.price || 0), 0);
  const unlimitedCount = items.filter((item) => item.limit == null).length;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {feedback && (
          <Alert severity={feedback.severity}>{feedback.message}</Alert>
        )}

        <SectionCard
          eyebrow="Commerce"
          title="Price Items"
          subtitle="Manage store items, bundles, featured pricing, and release windows."
        >
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle2">
                  {items.length} item{items.length !== 1 ? "s" : ""} total
                </Typography>
                <Chip
                  label={`${totalCoinValue} coins`}
                  color="info"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`$${totalDollarValue.toFixed(2)}`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${unlimitedCount} unlimited`}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={openCreateDialog}
              >
                New Item
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#000" }}>
                    <TableCell>Name</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Visibility</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No price items configured
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 1,
                                border: "1px dashed rgba(255,255,255,0.18)",
                                backgroundColor: "rgba(255,255,255,0.04)",
                                backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : "none",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                backgroundSize: "contain",
                                flexShrink: 0,
                              }}
                            />
                            <Stack>
                              <strong>{item.name}</strong>
                              {item.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {item.description}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {item.key}
                          </Typography>
                        </TableCell>
                        <TableCell>{getShopItemType(item.key)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={formatPrice(item)}
                            size="small"
                            color={item.currency === "dollar" ? "success" : "info"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(item.limit)}
                            size="small"
                            color={item.limit == null ? "warning" : "default"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.hidden ? "Hidden" : "Visible"}
                            size="small"
                            color={item.hidden ? "error" : "success"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(item)}
                              title="Edit item"
                            >
                              <Icon icon="mdi:pencil" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirmOpen(item)}
                              title="Delete item"
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
                💡 <strong>Note:</strong> Set limit to null for unlimited purchases,
                1 for one-time purchases, or any number for limited purchases.
              </Typography>
            </Box>
          </Stack>
        </SectionCard>
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? "Edit Price Item" : "Create New Price Item"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {!editingItem && (
              <TextField
                label="Item Key"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                fullWidth
                placeholder="e.g., textColors, nameChange"
                helperText="Unique identifier (cannot be changed after creation)"
              />
            )}
            <TextField
              label="Item Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              fullWidth
              placeholder="e.g., Name and Text Colors"
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
              placeholder="Item description"
            />
            <Stack spacing={1}>
              <Typography variant="subtitle2">Shop Image</Typography>
              <Box
                sx={{
                  height: 150,
                  borderRadius: 1,
                  border: "1px dashed rgba(255,255,255,0.18)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {imagePreviewUrl ? (
                  <Box
                    component="img"
                    src={imagePreviewUrl}
                    alt={formData.name || "Shop item"}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No image selected
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" component="label">
                  {imageFile ? `Selected: ${imageFile.name}` : "Choose Image"}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setImageFile(file);
                      if (file) setRemoveImage(false);
                      event.target.value = "";
                    }}
                  />
                </Button>
                <Button
                  variant={removeImage ? "contained" : "outlined"}
                  color={removeImage ? "error" : "inherit"}
                  disabled={!imageFile && !editingItem?.imageUrl}
                  onClick={() => {
                    setImageFile(null);
                    if (editingItem?.imageUrl) {
                      setRemoveImage((prev) => !prev);
                    } else {
                      setRemoveImage(false);
                    }
                  }}
                >
                  {removeImage ? "Will Remove" : "Remove Image"}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Optional image shown on the player shop card.
              </Typography>
            </Stack>
            <TextField
              label="Price"
              type="number"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Currency"
              select
              value={formData.currency}
              onChange={(e) =>
                setFormData({ ...formData, currency: e.target.value })
              }
              fullWidth
            >
              <MenuItem value="coins">Coins</MenuItem>
              <MenuItem value="dollar">Dollar</MenuItem>
            </TextField>
            <TextField
              label="Purchase Limit"
              type="number"
              value={formData.limit === null ? "" : formData.limit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  limit: e.target.value === "" ? null : e.target.value,
                })
              }
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Leave empty for unlimited, 1 for one-time, or enter a number"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hidden}
                  onChange={(e) =>
                    setFormData({ ...formData, hidden: e.target.checked })
                  }
                />
              }
              label="Hide from players"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={handleSaveItem}
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : editingItem ? (
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
        <DialogTitle>Delete Price Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Typography>
              Are you sure you want to delete "{deleteConfirmOpen?.name}"?
            </Typography>
            <Alert severity="warning">
              This action cannot be undone. The item will be permanently removed from the shop.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(null)}>Cancel</Button>
          <Button
            onClick={() =>
              handleDeleteItem(deleteConfirmOpen.id, deleteConfirmOpen.name)
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
