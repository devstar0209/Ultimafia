import React, { useRef } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Grid,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function CarouselBannersUploadField({
  title,
  description,
  banners = [],
  pending = false,
  onUpload,
  onRemove,
  previewHeight = 120,
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

        {banners.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Current Carousel Banners ({banners.length})
            </Typography>
            <Grid container spacing={1}>
              {banners.map((banner) => (
                <Grid item xs={6} sm={4} md={3} key={banner._id || banner.id}>
                  <Paper
                    sx={{
                      position: "relative",
                      height: previewHeight,
                      borderRadius: 1,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Box
                      component="img"
                      src={banner.url}
                      alt="Carousel banner"
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => onRemove(banner._id || banner.id)}
                      disabled={pending}
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        "&:hover": {
                          backgroundColor: "rgba(0,0,0,0.7)",
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={handlePickClick}
            disabled={pending}
          >
            {pending ? "Uploading..." : "Add Banner"}
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
