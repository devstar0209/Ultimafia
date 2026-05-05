import React, { useEffect, useState } from "react";
import {
  Alert,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  CircularProgress,
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
  updateAdminDefaultSettings,
} from "../../services/adminService";

export default function GeneralSettingsPage() {
  const { data, loading, error } = useAdminQuery(getAdminGeneralSettings);
  const [branding, setBranding] = useState(null);
  const [carouselBanners, setCarouselBanners] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [pendingKey, setPendingKey] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Coin Rewards
  const [registerCoinsReward, setRegisterCoinsReward] = useState(0);
  const [coinsPerDollar, setCoinsPerDollar] = useState(100);

  // Red Hearts
  const [initialRedHeartCapacity, setInitialRedHeartCapacity] = useState(15);
  const [maxBonusRedHearts, setMaxBonusRedHearts] = useState(5);
  const [redHeartRefreshIntervalMillis, setRedHeartRefreshIntervalMillis] = useState(82800000);

  // Gold Hearts
  const [initialGoldHeartCapacity, setInitialGoldHeartCapacity] = useState(0);
  const [goldHeartRefreshIntervalMillis, setGoldHeartRefreshIntervalMillis] = useState(82800000);

  // Ranked/Competitive
  const [minimumGamesForRanked, setMinimumGamesForRanked] = useState(5);
  const [minimumPointsForCompetitive, setMinimumPointsForCompetitive] = useState(150);
  const [pointsNominalAmount, setPointsNominalAmount] = useState(60);

  // Competitive Rounds
  const [openDaysPerCompetitiveRound, setOpenDaysPerCompetitiveRound] = useState(9);
  const [reviewDaysPerCompetitiveRound, setReviewDaysPerCompetitiveRound] = useState(4);

  useEffect(() => {
    if (data?.branding) {
      setBranding(data.branding);
      setCarouselBanners(data.branding?.banners?.carousel || []);
    }
    if (data?.defaultSettings) {
      setRegisterCoinsReward(data.defaultSettings.registerCoinsReward || 0);
      setCoinsPerDollar(data.defaultSettings.coinsPerDollar || 100);
      setInitialRedHeartCapacity(data.defaultSettings.initialRedHeartCapacity || 15);
      setMaxBonusRedHearts(data.defaultSettings.maxBonusRedHearts || 5);
      setRedHeartRefreshIntervalMillis(data.defaultSettings.redHeartRefreshIntervalMillis || 82800000);
      setInitialGoldHeartCapacity(data.defaultSettings.initialGoldHeartCapacity || 0);
      setGoldHeartRefreshIntervalMillis(data.defaultSettings.goldHeartRefreshIntervalMillis || 82800000);
      setMinimumGamesForRanked(data.defaultSettings.minimumGamesForRanked || 5);
      setMinimumPointsForCompetitive(data.defaultSettings.minimumPointsForCompetitive || 150);
      setPointsNominalAmount(data.defaultSettings.pointsNominalAmount || 60);
      setOpenDaysPerCompetitiveRound(data.defaultSettings.openDaysPerCompetitiveRound || 9);
      setReviewDaysPerCompetitiveRound(data.defaultSettings.reviewDaysPerCompetitiveRound || 4);
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

  async function saveDefaultSettings() {
    setSavingDefaults(true);
    setFeedback(null);

    try {
      await updateAdminDefaultSettings({
        registerCoinsReward: Number(registerCoinsReward || 0),
        coinsPerDollar: Number(coinsPerDollar || 100),
        initialRedHeartCapacity: Number(initialRedHeartCapacity || 15),
        maxBonusRedHearts: Number(maxBonusRedHearts || 5),
        redHeartRefreshIntervalMillis: Number(redHeartRefreshIntervalMillis || 82800000),
        initialGoldHeartCapacity: Number(initialGoldHeartCapacity || 0),
        goldHeartRefreshIntervalMillis: Number(goldHeartRefreshIntervalMillis || 82800000),
        minimumGamesForRanked: Number(minimumGamesForRanked || 5),
        minimumPointsForCompetitive: Number(minimumPointsForCompetitive || 150),
        pointsNominalAmount: Number(pointsNominalAmount || 60),
        openDaysPerCompetitiveRound: Number(openDaysPerCompetitiveRound || 9),
        reviewDaysPerCompetitiveRound: Number(reviewDaysPerCompetitiveRound || 4),
      });
      setFeedback({
        severity: "success",
        message: "Default settings saved successfully.",
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        message:
          error?.response?.data || "Could not save default settings right now.",
      });
    } finally {
      setSavingDefaults(false);
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
            subtitle="Configure currency defaults, game requirements, and reward parameters."
          >
            <Stack spacing={3}>
              {/* Default Rewards */}
              <Stack spacing={2}>
                <Typography variant="h6">💰 Default Rewards</Typography>
                <TextField
                  fullWidth
                  label="Register Coins Reward"
                  type="number"
                  value={registerCoinsReward}
                  onChange={(e) => setRegisterCoinsReward(e.target.value)}
                  placeholder="0"
                  helperText="Coins awarded to new registered users"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Coins Per $"
                  type="number"
                  value={coinsPerDollar}
                  onChange={(e) => setCoinsPerDollar(e.target.value)}
                  placeholder="100"
                  helperText="Number of coins granted for each dollar spent"
                  inputProps={{ min: 1 }}
                />
              </Stack>

              {/* Red Hearts */}
              <Stack spacing={2}>
                <Typography variant="h6">❤️ Red Hearts Settings</Typography>
                <TextField
                  fullWidth
                  label="Initial Red Heart Capacity"
                  type="number"
                  value={initialRedHeartCapacity}
                  onChange={(e) => setInitialRedHeartCapacity(e.target.value)}
                  placeholder="15"
                  helperText="Base red hearts capacity per user per day"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Max Bonus Red Hearts"
                  type="number"
                  value={maxBonusRedHearts}
                  onChange={(e) => setMaxBonusRedHearts(e.target.value)}
                  placeholder="5"
                  helperText="Maximum purchasable bonus red hearts"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Red Heart Refresh Interval (ms)"
                  type="number"
                  value={redHeartRefreshIntervalMillis}
                  onChange={(e) => setRedHeartRefreshIntervalMillis(e.target.value)}
                  placeholder="82800000"
                  helperText="Time between daily refreshes in milliseconds (82800000 = 23 hours)"
                  inputProps={{ min: 0 }}
                />
              </Stack>

              {/* Gold Hearts */}
              <Stack spacing={2}>
                <Typography variant="h6">💛 Gold Hearts Settings</Typography>
                <TextField
                  fullWidth
                  label="Initial Gold Heart Capacity"
                  type="number"
                  value={initialGoldHeartCapacity}
                  onChange={(e) => setInitialGoldHeartCapacity(e.target.value)}
                  placeholder="0"
                  helperText="Starting gold hearts for new users"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Gold Heart Refresh Interval (ms)"
                  type="number"
                  value={goldHeartRefreshIntervalMillis}
                  onChange={(e) => setGoldHeartRefreshIntervalMillis(e.target.value)}
                  placeholder="82800000"
                  helperText="Refresh interval in milliseconds"
                  inputProps={{ min: 0 }}
                />
              </Stack>

              {/* Ranked/Competitive Requirements */}
              <Stack spacing={2}>
                <Typography variant="h6">🏆 Ranked Access Requirements</Typography>
                <TextField
                  fullWidth
                  label="Minimum Games for Ranked"
                  type="number"
                  value={minimumGamesForRanked}
                  onChange={(e) => setMinimumGamesForRanked(e.target.value)}
                  placeholder="5"
                  helperText="Number of games required before ranked access"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Minimum Points for Competitive"
                  type="number"
                  value={minimumPointsForCompetitive}
                  onChange={(e) => setMinimumPointsForCompetitive(e.target.value)}
                  placeholder="150"
                  helperText="Points required to unlock competitive play"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Points per Nominal Game"
                  type="number"
                  value={pointsNominalAmount}
                  onChange={(e) => setPointsNominalAmount(e.target.value)}
                  placeholder="60"
                  helperText="Standard points awarded per ranked game"
                  inputProps={{ min: 0 }}
                />
              </Stack>

              {/* Competitive Rounds */}
              <Stack spacing={2}>
                <Typography variant="h6">⚔️ Competitive Round Duration</Typography>
                <TextField
                  fullWidth
                  label="Open Days Per Round"
                  type="number"
                  value={openDaysPerCompetitiveRound}
                  onChange={(e) => setOpenDaysPerCompetitiveRound(e.target.value)}
                  placeholder="9"
                  helperText="Days the competitive round is open for play"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label="Review Days Per Round"
                  type="number"
                  value={reviewDaysPerCompetitiveRound}
                  onChange={(e) => setReviewDaysPerCompetitiveRound(e.target.value)}
                  placeholder="4"
                  helperText="Days for results review and moderation"
                  inputProps={{ min: 0 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Total round duration: {Number(openDaysPerCompetitiveRound || 9) + Number(reviewDaysPerCompetitiveRound || 4)} days
                </Typography>
              </Stack>

              {/* Save Button */}
              <Button
                variant="contained"
                onClick={saveDefaultSettings}
                disabled={savingDefaults}
                startIcon={savingDefaults ? <CircularProgress size={20} /> : null}
                fullWidth
              >
                {savingDefaults ? "Saving..." : "Save All Settings"}
              </Button>

              <Stack spacing={2} sx={{ borderTop: "1px solid rgba(255,255,255,0.1)", pt: 3 }}>
                <Typography variant="h6">Settings Status</Typography>
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
              </Stack>
            </Stack>
          </SectionCard>
      </Grid>
    </Grid>
  );
}
