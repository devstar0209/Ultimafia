import React, { useEffect, useState } from "react";
import {
  Alert,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import ActionCard from "../../components/admin/ActionCard";
import ImageUploadField from "../../components/admin/ImageUploadField";
import CarouselBannersUploadField from "../../components/admin/CarouselBannersUploadField";
import PageFeedback from "../../components/admin/PageFeedback";
import SectionCard from "../../components/SectionCard";
import StatusChip from "../../components/StatusChip";
import useAdminQuery from "../../hooks/useAdminQuery";
import {
  getAdminGeneralSettings,
  removeAdminBannerImage,
  removeAdminPlatformLogo,
  uploadAdminBannerImage,
  uploadAdminPlatformLogo,
  uploadAdminCarouselBannerImage,
  removeAdminCarouselBannerImage,
} from "../../services/adminService";

export default function GeneralSettingsPage() {
  const { data, loading, error } = useAdminQuery(getAdminGeneralSettings);
  const [branding, setBranding] = useState(null);
  const [carouselBanners, setCarouselBanners] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [pendingKey, setPendingKey] = useState("");

  useEffect(() => {
    if (data?.branding) {
      setBranding(data.branding);
      setCarouselBanners(data.branding?.banners?.carousel || []);
    }
  }, [data]);

  const settingsModules = data?.modules || [];

  if (loading) {
    return (
      <PageFeedback
        title="Loading settings"
        description="Fetching the current admin settings summary from the backend."
      />
    );
  }

  if (error) {
    return (
      <PageFeedback
        title="Settings unavailable"
        description="The admin panel could not load general settings from the backend."
      />
    );
  }

  async function runBrandingAction(actionKey, action, successMessage) {
    setPendingKey(actionKey);
    setFeedback(null);

    try {
      const result = await action();
      setBranding(result.branding);
      if (actionKey === "carousel-banners") {
        setCarouselBanners(result.branding?.banners?.carousel || []);
      }
      setFeedback({
        severity: "success",
        message: successMessage,
      });
    } catch (actionError) {
      setFeedback({
        severity: "error",
        message:
          actionError?.response?.data || "Could not update branding right now.",
      });
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} xl={7}>
        <Stack spacing={3}>
          {feedback ? (
            <Alert severity={feedback.severity}>{feedback.message}</Alert>
          ) : null}

          <SectionCard
            eyebrow="Brand Assets"
            title="Platform Branding"
            subtitle="Uploads are written to the live uploads directory and applied on the public site when present."
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={12}>
                <ImageUploadField
                  title="Platform Logo"
                  description="Primary site logo shown in the main shell when a custom upload is available."
                  imageUrl={branding?.platformLogoUrl}
                  alt="Platform logo preview"
                  pending={pendingKey === "platform-logo"}
                  uploadLabel="Upload Logo"
                  previewHeight={132}
                  onUpload={(file) =>
                    runBrandingAction(
                      "platform-logo",
                      () => uploadAdminPlatformLogo(file),
                      "Platform logo updated."
                    )
                  }
                  onRemove={() =>
                    runBrandingAction(
                      "platform-logo",
                      removeAdminPlatformLogo,
                      "Platform logo removed."
                    )
                  }
                />
              </Grid>
              <Grid item xs={12} md={12}>
                <ImageUploadField
                  title="Welcome Banner"
                  description="Hero banner used on the public welcome page game panel."
                  imageUrl={branding?.banners?.welcome}
                  alt="Welcome banner preview"
                  pending={pendingKey === "banner-welcome"}
                  uploadLabel="Upload Banner"
                  previewHeight={180}
                  objectFit="cover"
                  onUpload={(file) =>
                    runBrandingAction(
                      "banner-welcome",
                      () => uploadAdminBannerImage("welcome", file),
                      "Welcome banner updated."
                    )
                  }
                  onRemove={() =>
                    runBrandingAction(
                      "banner-welcome",
                      () => removeAdminBannerImage("welcome"),
                      "Welcome banner removed."
                    )
                  }
                />
              </Grid>
              <Grid item xs={12} md={12}>
                <CarouselBannersUploadField
                  title="Carousel Banners"
                  description="Upload multiple banners to display in a carousel on the welcome page below the welcome banner."
                  banners={carouselBanners}
                  pending={pendingKey === "carousel-banners"}
                  previewHeight={120}
                  onUpload={(file) =>
                    runBrandingAction(
                      "carousel-banners",
                      () => uploadAdminCarouselBannerImage(file),
                      "Carousel banner added."
                    )
                  }
                  onRemove={(bannerId) =>
                    runBrandingAction(
                      "carousel-banners",
                      () => removeAdminCarouselBannerImage(bannerId),
                      "Carousel banner removed."
                    )
                  }
                />
              </Grid>
            </Grid>
          </SectionCard>

        </Stack>
      </Grid>
      <Grid item xs={12} xl={5}>
        <SectionCard
            eyebrow="Platform Defaults"
            title="General Settings"
            subtitle="Manage live branding assets for the logo, welcome banner, and site-wide defaults."
          >
            <Grid container spacing={2}>
              {settingsModules.map((module) => (
                <Grid item xs={12} md={6} key={module.title}>
                  <Paper
                    sx={{
                      p: 2.25,
                      height: "100%",
                      backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <Stack spacing={1.2}>
                      <Typography variant="h4">{module.title}</Typography>
                      <Typography color="text.secondary">
                        {module.description}
                      </Typography>
                      <StatusChip label={module.status} />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
      </Grid>
    </Grid>
  );
}
