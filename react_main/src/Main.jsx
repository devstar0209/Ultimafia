import React, { lazy, useState, useContext, useEffect, Suspense } from "react";
import { Route, Link, Navigate, Routes, useLocation, NavLink } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import axios from "axios";
import { Icon } from "@iconify/react";
import { ThemeProvider, CssBaseline, AppBar, Link as MuiLink } from "@mui/material";

import {
  UserContext,
  SiteInfoContext,
  SiteInfoProvider,
  UserProvider,
} from "./Contexts";
import { getSiteTheme } from "./constants/themes";
import { AlertList, useErrorAlert } from "./components/Alerts";
import UserNavSection from "./pages/User/UserNavSection";
import CookieBanner from "./components/CookieBanner";
import DailySpinFloatingButton from "./components/DailySpinFloatingButton";
import NavDropdown from "./components/NavDropdown";
import { Loading } from "./components/Loading";
import "css/main.css";

// Navigation icons removed - now using text-only navigation
import {
  Box,
  Stack,
  Paper,
  Typography,
  Button,
  Snackbar,
  Alert,
  AlertTitle,
} from "@mui/material";

import { Announcement } from "./components/alerts/Announcement";
import SiteLogo from "./components/SiteLogo";
import { useIsPhoneDevice } from "./hooks/useIsPhoneDevice";
import { useSnowstorm } from "./hooks/useSnowstorm";
import { GuestAuthButtons } from "./components/GuestAuthButtons";

// Component to handle snowstorm with user settings
function SnowstormController() {
  const user = useContext(UserContext);
  const disableSnowstorm = user?.settings?.disableSnowstorm || false;
  useSnowstorm(disableSnowstorm);
  return null;
}

function ReferralLoginRedirect() {
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const referrer = String(params.get("ref") || "").trim();

    if (referrer) {
      window.localStorage.setItem("referrer", referrer);
    }

    setReady(true);
  }, [location.search]);

  if (!ready) return null;

  return <Navigate to="/welcome" replace />;
}

function ErrorBox({ error, resetErrorBoundary }) {
  const location = useLocation();
  const [errorLocation, setErrorLocation] = useState(location.pathname);

  useEffect(() => {
    console.error(error);
  }, []);

  useEffect(() => {
    if (location.pathname !== errorLocation) {
      resetErrorBoundary();
    }
  }, [location.pathname]);

  return (
    <Paper
      sx={{
        mx: "auto",
        my: "10%",
        p: 1,
        width: "320px",
      }}
    >
      <Stack direction="column" spacing={1}>
        <Typography variant="h3">Error:</Typography>
        <Typography color="red" sx={{ wordBreak: "break-word" }}>
          {error.message}
        </Typography>
        <Button onClick={resetErrorBoundary}>Refresh</Button>
      </Stack>
    </Paper>
  );
}

function ErrorFallback({ error, resetErrorBoundary }) {
  const errorBox = (
    <ErrorBox error={error} resetErrorBoundary={resetErrorBoundary} />
  );
  return <Main errorContent={errorBox} />;
}

function ErrorFallbackNoMain({ error, resetErrorBoundary }) {
  return <ErrorBox error={error} resetErrorBoundary={resetErrorBoundary} />;
}

function Main(props) {
  const errorContent = props.errorContent;
  const location = useLocation();
  const isWelcomeRoute =
    location.pathname === "/welcome" || location.pathname === "/";

  const [isUserLoading, setUserLoading] = useState(true);
  const [siteTheme, setSiteTheme] = useState(() => getSiteTheme());
  const [isSiteInfoLoading, setSiteInfoLoading] = useState(true);
  const [showAnnouncementTemporarily, setShowAnnouncementTemporarily] =
    useState(false);

  const isPhoneDevice = useIsPhoneDevice();

  const loading = isUserLoading || isSiteInfoLoading;

  const Game = lazy(() => import("pages/Game/Game"));
  const Play = lazy(() => import("pages/Play/Play"));
  const Community = lazy(() => import("pages/Community/Community"));
  const Fame = lazy(() => import("pages/Fame/Fame"));
  const Learn = lazy(() => import("pages/Learn/Learn"));
  const Policy = lazy(() => import("pages/Policy/Policy"));
  const User = lazy(() => import("pages/User/User"));
  const Welcome = lazy(() => import("pages/Welcome/Welcome"));
  const Shop = lazy(() => import("pages/Shop/Shop"));
  const AvatarShop = lazy(() => import("pages/Shop/AvatarShop"));
  const EmoteShop = lazy(() => import("pages/Shop/EmoteShop"));
  const AuthAction = lazy(() => import("pages/AuthAction/AuthAction"));
  const DiscordRedirect = lazy(() =>
    import("pages/DiscordRedirect/DiscordRedirect")
  );

  const siteContent = (
    <Stack sx={{
      backgroundColor: "background.default",
      minHeight: "100vh",
    }}>
      <CookieBanner />
      <Header
        setShowAnnouncementTemporarily={setShowAnnouncementTemporarily}
      />
      <Stack direction="row" className="site-wrapper" sx={{
        flex: "1",
        justifyContent: "center",
      }}>
        <Stack direction="column" spacing={1} sx={{
          margin: isWelcomeRoute ? "0 auto 30px" : "30px auto",
          px: isWelcomeRoute ? 0 : isPhoneDevice ? 1 : 20,
          py: isWelcomeRoute ? 0 : 1,
          width: "100%",
          maxWidth: "100%",
        }}>
          <Announcement
            showAnnouncementTemporarily={showAnnouncementTemporarily}
            setShowAnnouncementTemporarily={setShowAnnouncementTemporarily}
          />
          <div className="inner-container">
            {errorContent ? (
              errorContent
            ) : (
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="welcome" element={<Welcome />} />
                  <Route path="play/*" element={<Play />} />
                  <Route path="community/*" element={<Community />} />
                  <Route path="fame/*" element={<Fame />} />
                  <Route path="learn/*" element={<Learn />} />
                  <Route path="policy/*" element={<Policy />} />
                  <Route path="user/*" element={<User />} />
                  <Route path="auth/login" element={<ReferralLoginRedirect />} />
                  <Route path="auth/action" element={<AuthAction />} />
                  <Route path="auth/discord/redirect" element={<DiscordRedirect />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="shop/avatars" element={<AvatarShop />} />
                  <Route path="shop/emotes" element={<EmoteShop />} />
                  <Route path="*" element={<Navigate to="play" />} />
                </Routes>
              </Suspense>
            )}
          </div>
          <InGameWarning />
          <AlertList />
        </Stack>
      </Stack>
      <Footer />
    </Stack>
  );

  // Site content will display instead of game if content is being overriden by the error boundary
  const gameContent = errorContent ? (
    siteContent
  ) : (
    <Suspense fallback={<Loading />}>
      <Game />
      <AlertList />
    </Suspense>
  );

  const mainContent = (
    <SiteInfoProvider setSiteInfoLoading={setSiteInfoLoading}>
      {loading && <Loading />}
      {!loading && (
        <Routes>
          <Route path="/game/:gameId/*" element={gameContent} />
          <Route path="/*" element={siteContent} />
        </Routes>
      )}
    </SiteInfoProvider>
  );

  return (
    <ThemeProvider theme={siteTheme} noSsr defaultMode="dark">
      <CssBaseline enableColorScheme />
      <Suspense fallback={<Loading />}>
        <ErrorBoundary
          FallbackComponent={
            errorContent !== undefined ? ErrorFallbackNoMain : ErrorFallback
          }
          onReset={() =>
            (window.location.href =
              window.location.origin + window.location.pathname)
          }
        >
          <UserProvider
            setUserLoading={setUserLoading}
            setSiteTheme={setSiteTheme}
          >
            <SnowstormController />
            <DailySpinFloatingButton />
            <Routes>
              <Route path="/" element={<Navigate to="/welcome" />} />
              <Route path="/*" element={mainContent} />
            </Routes>
          </UserProvider>
        </ErrorBoundary>
      </Suspense>
    </ThemeProvider>
  );
}

function Header({ setShowAnnouncementTemporarily }) {
  const user = useContext(UserContext);
  const isPhoneDevice = useIsPhoneDevice();

  const openAnnouncements = () => {
    setShowAnnouncementTemporarily(true);
  };

  return (
    <AppBar position="sticky" sx={{
      backgroundColor: "rgba(10, 14, 18, 0.78)",
      color: "text.primary",
      backdropFilter: "blur(16px)",
      backgroundImage: "none",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "none",
    }}>

      {/* Mobile AppBar */}
      {isPhoneDevice && (
        <Stack direction="row" sx={{
          alignItems: "center",
          width: "100%",
          px: 1,
          py: 0.75,
          overflow: "hidden",
        }}>
          {/* Unified mobile menu */}
          <NavDropdown
            isMobileMenu={true}
            groups={[
              {
                label: "Play",
                items: [
                  { text: "Play", path: "/play" },
                  {
                    text: "Host",
                    path: "/play/host",
                    hide: !user.loggedIn,
                  },
                  {
                    text: "Decks",
                    path: "/play/decks",
                    hide: !user.loggedIn,
                  },
                ],
              },
              {
                label: "Community",
                items: [
                  { text: "Forums", path: "/community/forums" },
                  { text: "Users", path: "/community/users" },
                  { text: "Calendar", path: "/community/calendar" },
                ],
              },
              {
                label: "Competitive",
                items: [
                  { text: "Competitive", path: "/fame/competitive" },
                ],
              },
              {
                label: "Learn",
                items: [
                  { text: "Games", path: "/learn/games" },
                  { text: "Terminology", path: "/learn/terminology" },
                ],
              },
              {
                label: "Policy",
                items: [
                  { text: "Rules", path: "/policy/rules" },
                  { text: "Moderation", path: "/policy/moderation" },
                ],
              },
              {
                label: "Shop",
                items: [
                  {
                    text: "Shop",
                    path: "/shop",
                    hide: !user.loggedIn,
                  },
                ],
              },
            ]}
          />
          <SiteLogo small />
          {/* User section */}
          <div style={{ flex: "1 0" }}>
            {user.loggedIn ? (
              <UserNavSection
                openAnnouncements={openAnnouncements}
                user={user}
                useUnreadNotifications={useUnreadNotifications}
              />
            ) : (
              <GuestAuthButtons />
            )}
          </div>
        </Stack>
      )}

      {/* Desktop AppBar */}
      {!isPhoneDevice && (
        <Stack direction="row" spacing={2} sx={{
          alignItems: "center",
          px: 2,
          py: 0.75,
        }}>
          <SiteLogo />
          <Stack direction="row" spacing={2} className="nav" sx={{
            flexGrow: "1",
            alignItems: "center",
            width: "100%",
          }}>
            <NavLink
              to="/play"
              style={({ isActive }) => ({
                textTransform: "uppercase",
                color: "inherit",
                padding: "0 var(--mui-spacing)",
                backgroundColor: isActive
                  ? "rgba(var(--mui-palette-primary-mainChannel) / 0.14)"
                  : undefined,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                minHeight: 36,
              })}
              >
              <Typography variant="h3">Play</Typography>
            </NavLink>
            <NavDropdown
              label="Community"
              items={[
                { text: "Forums", path: "/community/forums" },
                { text: "Users", path: "/community/users" },
                { text: "Calendar", path: "/community/calendar" },
              ]}
            />
            <NavLink
              to="/fame/competitive"
              style={({ isActive }) => ({
                textTransform: "uppercase",
                color: "inherit",
                padding: "0 var(--mui-spacing)",
                backgroundColor: isActive
                  ? "rgba(var(--mui-palette-primary-mainChannel) / 0.14)"
                  : undefined,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                minHeight: 36,
              })}
            >
              <Typography variant="h3">Competitive</Typography>
            </NavLink>
            <NavDropdown
              label="Learn"
              items={[
                { text: "Games", path: "/learn/games" },
                { text: "Glossary", path: "/learn/glossary" },
              ]}
            />
            <NavDropdown
              label="Policy"
              items={[
                { text: "Rules", path: "/policy/rules" },
                { text: "Moderation", path: "/policy/moderation" },
              ]}
            />
            {user.loggedIn && (
              <NavLink
                to="/shop"
                style={({ isActive }) => ({
                  textTransform: "uppercase",
                  color: "inherit",
                  padding: "0 var(--mui-spacing)",
                  backgroundColor: isActive
                    ? "rgba(var(--mui-palette-primary-mainChannel) / 0.14)"
                    : undefined,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 36,
                })}
              >
                <Typography variant="h3">Shop</Typography>
              </NavLink>
            )}
            <Box sx={{
              marginLeft: "auto !important",
            }}>
              {user.loggedIn ? (
                <UserNavSection
                  openAnnouncements={openAnnouncements}
                  user={user}
                  useUnreadNotifications={useUnreadNotifications}
                />
              ) : (
                <GuestAuthButtons />
              )}
            </Box>
          </Stack>
        </Stack>
      )}
    </AppBar>
  );
}

function InGameWarning() {
  const user = useContext(UserContext);
  const errorAlert = useErrorAlert();

  function onGameLeave() {
    axios
      .post("/api/game/leave")
      .then(() => {
        user.setInGame(null);
      })
      .catch(errorAlert);
  }

  return (
    <Snackbar open={user.inGame !== null}>
      <Alert
        severity="warning"
        variant="outlined"
        sx={{
          width: "100%",
          backgroundColor: "background.paper",
        }}
        slotProps={{
          message: {
            sx: {
              flex: "1",
            },
          },
        }}
      >
        <AlertTitle>You are in a game in progress.</AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button href={`/game/${user.inGame}`} size="small" sx={{ flex: "1" }}>
            Return
          </Button>
          <Button onClick={() => onGameLeave()} size="small" sx={{ flex: "1" }}>
            Leave
          </Button>
        </Stack>
      </Alert>
    </Snackbar>
  );
}

// Custom hook to get unread notification count
function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextRestart, setNextRestart] = useState();
  const siteInfo = useContext(SiteInfoContext);

  useEffect(() => {
    let cancelled = false;

    getNotifs();
    var notifGetInterval = setInterval(() => getNotifs(), 10 * 1000);

    return () => {
      cancelled = true;
      clearInterval(notifGetInterval);
    };

    function getNotifs() {
      axios
        .get("/api/notifs")
        .then((res) => {
          if (cancelled) return;

          var nextRestart = res.data[0];
          var notifs = res.data.slice(1);

          setNextRestart(nextRestart);
          setUnreadCount(notifs.length);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (nextRestart && nextRestart > Date.now()) {
      var restartMinutes = Math.ceil((nextRestart - Date.now()) / 1000 / 60);
      siteInfo.showAlert(
        `The server will be restarting in ${restartMinutes} minutes.`,
        "basic",
        true
      );
    }
  }, [nextRestart]);

  return unreadCount;
}

function Footer() {
  const isPhoneDevice = useIsPhoneDevice();
  let year = new Date().getYear() + 1900;

  return (
    <AppBar position="static" sx={{
      backgroundColor: "rgba(10, 14, 18, 0.92)",
      color: "text.primary",
      backgroundImage: "none",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "none",
    }}>
      <Stack direction="column" spacing={2} sx={{
        p: 2,
        alignItems: "center",
        textAlign: "center",
        "& a": {
          textDecoration: "none",
        },
      }}>
        <Stack direction="row" spacing={2} sx={{
          fontSize: "xx-large",
        }}>

          <MuiLink
            href="https://t.me/+ZUP0erUElW1hMTAx"
            target="blank"
            rel="noopener noreferrer nofollow"
            sx={{ display: "flex", }}
          >
            <Icon
              icon="simple-icons:telegram"
              style={{ color: "#5865F2" }}
            />
          </MuiLink>
          
          <MuiLink
            href="https://discord.gg/x8eJSjfSd"
            target="blank"
            rel="noopener noreferrer nofollow"
            sx={{ display: "flex", }}
          >
            <Icon
              icon="simple-icons:discord"
              style={{ color: "#5865F2" }}
            />
          </MuiLink>
        </Stack>
        <Typography variant="body2" sx={{ textAlign: "center" }}>
          By accessing this website, you agree to our{" "}
          <MuiLink
            component={Link}
            to="/policy/tos"
          >
            Terms of Service
          </MuiLink>
          {" "}and{" "}
          <MuiLink
            component={Link}
            to="/policy/privacy"
          >
            Privacy Policy
          </MuiLink>
          .
        </Typography>
        <Stack direction={isPhoneDevice ? "column" : "row"} spacing={isPhoneDevice ? 0.5 : 2} sx={{
        }}>
          <Typography variant="body2">
            © {year} PassionMafia
          </Typography>
          <MuiLink
            variant="body2"
            href="https://www.behance.net/passiongodjob"
            rel="noopener noreferrer nofollow"
          >
            {"Supported by GodJob LLC"}
          </MuiLink>
        </Stack>
      </Stack>
    </AppBar>
  );
}

export default Main;
