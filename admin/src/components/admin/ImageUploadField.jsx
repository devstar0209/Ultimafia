import React, { useRef } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export default function ImageUploadField({
  title,
  description,
  imageUrl = "",
  alt,
  uploadLabel = "Upload image",
  pending = false,
  onUpload,
  onRemove,
  previewHeight = 160,
  objectFit = "contain",
}) {
  const inputRef = useRef(null);

  function handlePickClick() {
    if (pending) return;
    inputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file && onUpload) {
      onUpload(file);
    }
  }

  return (
    <Paper
      sx={{
        p: 2,
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h4">{title}</Typography>
          <Typography color="text.secondary">{description}</Typography>
        </Stack>
        <Box
          sx={{
            height: previewHeight,
            borderRadius: 2,
            border: "1px dashed rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={alt || title}
              sx={{
                width: "100%",
                height: "100%",
                objectFit,
              }}
            />
          ) : (
            <Typography color="text.secondary">No image uploaded</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={handlePickClick}
            disabled={pending}
          >
            {pending ? "Uploading..." : uploadLabel}
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            disabled={pending || !imageUrl}
            onClick={onRemove}
          >
            Remove
          </Button>
        </Stack>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />
      </Stack>
    </Paper>
  );
}
