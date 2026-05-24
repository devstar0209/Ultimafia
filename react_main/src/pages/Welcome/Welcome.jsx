import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid2,
  Stack,
  Typography,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SportsEsportsOutlinedIcon from "@mui/icons-material/SportsEsportsOutlined";
import { Link, Navigate } from "react-router-dom";
import "css/main.css";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from "react-responsive-carousel";
import { Auth } from "../../components/Auth";
import GameIcon from "../../components/GameIcon";
import bannerImage from "../../images/welcome_page/banner.png";
import welcomeSlideOne from "../../images/welcome_page/welcome-page_1.png";
import welcomeSlideTwo from "../../images/welcome_page/welcome-page_2.png";
import welcomeSlideThree from "../../images/welcome_page/welcome-page_3.png";
import welcomeSlideFour from "../../images/welcome_page/welcome-page_4.png";
import {
  getAuth,
  getRedirectResult,
  inMemoryPersistence,
} from "firebase/auth";
import axios from "axios";
import { useSnackbar } from "hooks/useSnackbar";
import { Loading } from "../../components/Loading";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import { SiteInfoContext, UserContext } from "Contexts";

const GAME_DETAILS = {
  Mafia: {
    label: "Social deduction",
    description: "Bluff, investigate, vote, and survive the table.",
    accent: "#f5b94f",
  },
  Resistance: {
    label: "Hidden teams",
    description: "Build missions, expose spies, and control trust.",
    accent: "#40d6bd",
  },
  "Wacky Words": {
    label: "Party writing",
    description: "Write fast, win laughs, and take the vote.",
    accent: "#72e6dc",
  },
  "Liars Dice": {
    label: "Dice bluffing",
    description: "Push the bid, sell the bluff, call the moment.",
    accent: "#77d38c",
  },
  "Texas Hold Em": {
    label: "Poker",
    description: "Play the board, price the hand, pressure the table.",
    accent: "#edb334",
  },
  "Secret Dictator": {
    label: "Policy bluffing",
    description: "Win elections, pass policy, and hide your agenda.",
    accent: "#e59f3a",
  },
  Acrotopia: {
    label: "Creative party",
    description: "Turn strange letters into the best answer in the room.",
    accent: "#ff7468",
  },
  "Connect Four": {
    label: "Classic duel",
    description: "Drop pieces, set traps, and force the fourth.",
    accent: "#4f9ded",
  },
  Jotto: {
    label: "Word logic",
    description: "Use tight guesses to crack the hidden word.",
    accent: "#74b9ff",
  },
  Cheat: {
    label: "Card bluffing",
    description: "Dump cards, fake confidence, punish bad claims.",
    accent: "#ffb26f",
  },
  Ratscrew: {
    label: "Reaction cards",
    description: "Spot patterns first and take control of the pile.",
    accent: "#d44b42",
  },
  Battlesnakes: {
    label: "Arena strategy",
    description: "Claim space, cut routes, and stay alive longer.",
    accent: "#2f9e66",
  },
  "Dice Wars": {
    label: "Territory",
    description: "Expand borders, choose fights, and roll for control.",
    accent: "#a178ff",
  },
};

const FALLBACK_GAME_ORDER = Object.keys(GAME_DETAILS);

const FEATURED_GAME_KEYS = [
  "Mafia",
  "Wacky Words",
  "Liars Dice",
  "Texas Hold Em",
  "Resistance",
  "Secret Dictator",
  "Acrotopia",
  "Connect Four",
];

const PROMO_SLIDES = [
  {
    id: "play",
    url: welcomeSlideOne,
    eyebrow: "Skill-game lobby",
    title: "Games, table talk, and real moments.",
    description:
      "Browse bluffing, deduction, cards, dice, and party games built for sharp plays, funny turns, and live table chat.",
  },
  {
    id: "reward",
    url: welcomeSlideTwo,
    eyebrow: "Eligible cash rewards",
    title: "Win with reads, timing, odds, and nerve.",
    description:
      "Supported prize formats put the focus on decisions at the table, from bold calls to patient strategy.",
  },
  {
    id: "host",
    url: welcomeSlideThree,
    eyebrow: "Play together",
    title: "Meet players, chat live, run it back.",
    description:
      "Jump from lobby browsing into real-time rooms where every vote, bluff, joke, and rematch keeps the table moving.",
  },
  {
    id: "rematch",
    url: welcomeSlideFour,
    eyebrow: "Fast sessions",
    title: "Make friends through the next round.",
    description:
      "Find a table, enjoy the chaos, keep chatting, and come back for the players as much as the games.",
  },
];

const CATEGORY_ITEMS = [
  { label: "Deduction", icon: PsychologyAltOutlinedIcon },
  { label: "Party", icon: SportsEsportsOutlinedIcon },
  { label: "Cards", icon: CasinoOutlinedIcon },
  { label: "Dice", icon: CasinoOutlinedIcon },
  { label: "Rewards", icon: AttachMoneyIcon },
];

const TRUST_ITEMS = [
  {
    title: "Cash-prize formats",
    description: "Eligible rooms can offer real-money rewards for skill-driven play.",
    icon: AttachMoneyIcon,
  },
  {
    title: "Real-time table chat",
    description: "Talk through reads, jokes, votes, and reactions while the game moves.",
    icon: ChatBubbleOutlineRoundedIcon,
  },
  {
    title: "Friends and rematches",
    description: "Meet regulars, keep the table energy alive, and play another round.",
    icon: GroupsOutlinedIcon,
  },
];

const PROMO_SUPPORT_BLOCKS = [
  {
    title: "Fun around the table",
    description:
      "Every match creates room for bold bluffs, bad reads, clever jokes, and moments worth talking about.",
    icon: SportsEsportsOutlinedIcon,
    tags: ["Bluffs", "Party rounds", "Rematches"],
  },
  {
    title: "Live chat while playing",
    description:
      "Real-time rooms keep players connected before, during, and after each round.",
    icon: ChatBubbleOutlineRoundedIcon,
    tags: ["Table talk", "Reactions", "Friends"],
  },
];

const WELCOME_ANIMATION_STYLES = {
  "@keyframes welcomeFadeUp": {
    "0%": {
      opacity: 0,
      transform: "translate3d(0, 18px, 0)",
    },
    "100%": {
      opacity: 1,
      transform: "translate3d(0, 0, 0)",
    },
  },
  "@keyframes welcomeImageDrift": {
    "0%": {
      transform: "scale(1.02) translate3d(-0.4%, 0, 0)",
    },
    "100%": {
      transform: "scale(1.08) translate3d(0.6%, -0.4%, 0)",
    },
  },
  "@keyframes welcomeGlow": {
    "0%, 100%": {
      boxShadow: "0 0 0 rgba(245,185,79,0)",
    },
    "50%": {
      boxShadow: "0 0 24px rgba(245,185,79,0.22)",
    },
  },
  "@media (prefers-reduced-motion: reduce)": {
    "& *": {
      animationDuration: "0.001ms !important",
      animationIterationCount: "1 !important",
      scrollBehavior: "auto !important",
      transitionDuration: "0.001ms !important",
    },
  },
};

function entranceSx(delay = 0) {
  return {
    opacity: 0,
    animation: `welcomeFadeUp 640ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms forwards`,
  };
}

function hasBrandingPayload(branding) {
  return Boolean(
    branding?.platformLogo ||
      Object.keys(branding?.banners || {}).length > 0 ||
      (Array.isArray(branding?.carousel) && branding.carousel.length > 0)
  );
}

function getGameDetails(gameType) {
  return GAME_DETAILS[gameType] || {
    label: "Game mode",
    description: "Browse the lobby and find the right table.",
    accent: "#40d6bd",
  };
}

function getGameLink(gameType) {
  return `/play?game=${encodeURIComponent(gameType)}`;
}

function PromoCarousel({ slides, showArrows }) {
  return (
    <Box
      sx={{
        width: "100%",
        height: { xs: 392, md: 476, lg: 500 },
        minHeight: { xs: 392, md: 476, lg: 500 },
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.1)",
        backgroundColor: "#10181d",
        boxShadow: "0 20px 70px rgba(0,0,0,0.34)",
        ...entranceSx(0),
        "& .carousel-root, & .carousel, & .slider-wrapper, & .slider, & .slide": {
          height: "100%",
        },
        "& .carousel .slider-wrapper": {
          overflow: "hidden",
        },
        "& .carousel .control-dots": {
          bottom: 14,
          left: 18,
          width: "auto",
          m: 0,
          p: 0,
          textAlign: "left",
        },
      }}
    >
      <Carousel
        showArrows={showArrows}
        showStatus={false}
        showThumbs={false}
        infiniteLoop
        autoPlay
        interval={5400}
        transitionTime={560}
        swipeable
        emulateTouch
        dynamicHeight={false}
        useKeyboardArrows
        renderIndicator={(onClickHandler, isSelected, index, label) => (
          <button
            type="button"
            onClick={onClickHandler}
            style={{
              width: isSelected ? 28 : 9,
              height: 9,
              margin: "0 4px",
              padding: 0,
              border: "none",
              borderRadius: 9,
              cursor: "pointer",
              background: isSelected ? "#f5b94f" : "rgba(255,255,255,0.38)",
              transition: "width 180ms ease, background 180ms ease",
            }}
            aria-label={`${label} ${index + 1}`}
          />
        )}
      >
        {slides.map((slide) => (
          <Box
            key={slide.id}
            sx={{
              position: "relative",
              height: "100%",
              minHeight: { xs: 392, md: 476, lg: 500 },
              textAlign: "left",
            }}
          >
            <Box
              component="img"
              src={slide.url}
              alt=""
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transformOrigin: "center",
                animation: "welcomeImageDrift 12s ease-in-out infinite alternate",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(12,18,22,0.96), rgba(12,18,22,0.58) 56%, rgba(12,18,22,0.12)), linear-gradient(0deg, rgba(12,18,22,0.88), rgba(12,18,22,0.04) 60%)",
              }}
            />
            <Stack
              spacing={1}
              sx={{
                position: "absolute",
                left: { xs: 18, md: 28 },
                right: { xs: 18, md: "36%" },
                bottom: { xs: 52, md: 68 },
              }}
            >
              <Chip
                label={slide.eyebrow}
                size="small"
                sx={{
                  alignSelf: "flex-start",
                  color: "#11161a",
                  backgroundColor: "#f5b94f",
                  fontWeight: 900,
                }}
              />
              <Typography
                component="h2"
                sx={{
                  maxWidth: 640,
                  fontSize: { xs: "2.1rem", md: "3.2rem" },
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: 0,
                }}
              >
                {slide.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ maxWidth: 560, color: "rgba(235,240,245,0.84)" }}
              >
                {slide.description}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Carousel>
    </Box>
  );
}

function PromoSupportPanel() {
  return (
    <Grid2 container spacing={1} sx={{ flex: 1 }}>
      {PROMO_SUPPORT_BLOCKS.map((item, index) => {
        const IconComponent = item.icon;

        return (
          <Grid2 key={item.title} size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                height: "100%",
                minHeight: { xs: 132, md: 148 },
                p: 1.35,
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.09)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))",
                transition:
                  "transform 180ms ease, border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
                ...entranceSx(120 + index * 90),
                "&:hover": {
                  transform: "translateY(-3px)",
                  borderColor: "rgba(245,185,79,0.45)",
                  backgroundColor: "rgba(255,255,255,0.055)",
                  boxShadow: "0 16px 38px rgba(0,0,0,0.24)",
                },
              }}
            >
              <Stack spacing={1} sx={{ height: "100%" }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                      borderRadius: 1.25,
                      color: "#11161a",
                      backgroundColor: "#f5b94f",
                      animation: "welcomeGlow 3.8s ease-in-out infinite",
                    }}
                  >
                    <IconComponent fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h3" noWrap>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Featured flow
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.6}
                  sx={{ mt: "auto", flexWrap: "wrap", gap: 0.6 }}
                >
                  {item.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        height: 24,
                        borderColor: "rgba(255,255,255,0.1)",
                        backgroundColor: "rgba(255,255,255,0.045)",
                      }}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
          </Grid2>
        );
      })}
    </Grid2>
  );
}

function CategoryButton({ item }) {
  const IconComponent = item.icon;

  return (
    <Button
      type="button"
      variant="outlined"
      startIcon={<IconComponent fontSize="small" />}
      sx={{
        minHeight: 40,
        borderColor: "rgba(255,255,255,0.1)",
        color: "text.primary",
        backgroundColor: "rgba(255,255,255,0.035)",
        transition:
          "transform 160ms ease, border-color 160ms ease, background-color 160ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: "#40d6bd",
          backgroundColor: "rgba(64,214,189,0.08)",
        },
      }}
    >
      {item.label}
    </Button>
  );
}

function GameCard({ game, index = 0 }) {
  const details = getGameDetails(game.key);

  return (
    <Box
      component={Link}
      to={getGameLink(game.key)}
      sx={{
        minHeight: 152,
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 0.75,
        p: 1.1,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.09)",
        color: "text.primary",
        textDecoration: "none",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.028))",
        transition:
          "transform 180ms ease, border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
        ...entranceSx(260 + index * 45),
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: details.accent,
          backgroundColor: "rgba(255,255,255,0.065)",
          boxShadow: `0 18px 34px rgba(0,0,0,0.24), 0 0 22px ${details.accent}26`,
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
        <GameIcon
          gameType={game.key}
          alt=""
          size={46}
          sx={{
            width: 46,
            height: 46,
            flex: "0 0 auto",
            borderRadius: 1.25,
            objectFit: "contain",
            backgroundColor: "rgba(0,0,0,0.22)",
            border: `1px solid ${details.accent}`,
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" noWrap>
            {game.title || game.key}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {details.label}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {details.description}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">
          Open in lobby
        </Typography>
        <KeyboardArrowRightRoundedIcon
          fontSize="small"
          sx={{ color: "text.secondary" }}
        />
      </Stack>
    </Box>
  );
}

function TrustCard({ item, index = 0 }) {
  const IconComponent = item.icon;

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 118,
        p: 1.25,
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.09)",
        backgroundColor: "rgba(255,255,255,0.04)",
        transition:
          "transform 180ms ease, border-color 180ms ease, background-color 180ms ease",
        ...entranceSx(220 + index * 70),
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: "rgba(64,214,189,0.36)",
          backgroundColor: "rgba(255,255,255,0.058)",
        },
      }}
    >
      <Stack spacing={0.75}>
        <IconComponent sx={{ color: "#f5b94f" }} />
        <Typography variant="h3">{item.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.description}
        </Typography>
      </Stack>
    </Box>
  );
}

// localStorage.setItem('firebase:debug', 'true');

if (localStorage.getItem("firebase:debug") !== null) {
  localStorage.removeItem("firebase:debug");
}
if (localStorage.getItem("showChatTab") !== null) {
  localStorage.removeItem("showChatTab");
}

export const Welcome = () => {
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const [isLoading, setIsLoading] = useState(true);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const isPhoneDevice = useIsPhoneDevice();
  const snackbarHook = useSnackbar();
  const snackbarHookRef = useRef(snackbarHook);

  useEffect(() => {
    snackbarHookRef.current = snackbarHook;
  }, [snackbarHook]);

  useEffect(() => {
    const auth = getAuth();
    auth.setPersistence(inMemoryPersistence);

    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        const idToken = await auth.currentUser.getIdToken(true);
        axios
          .post("/api/auth", { idToken })
          .then(() => {
            window.location.reload();
          })
          .catch((err) => {
            console.log(err);

            if (err?.response?.status === 403 && err?.response?.data) {
              try {
                const data =
                  typeof err.response.data === "string"
                    ? JSON.parse(err.response.data)
                    : err.response.data;
                if (data.siteBanned) {
                  snackbarHookRef.current.popSiteBanned(data.banExpires);
                  setIsLoading(false);
                  return;
                }
                if (data.deleted) {
                  snackbarHookRef.current.popUserDeleted();
                  setIsLoading(false);
                  return;
                }
              } catch {
                // Not a site-ban error, continue with regular error handling.
              }
            }

            snackbarHookRef.current.popUnexpectedError();
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const activeBranding = useMemo(
    () => (hasBrandingPayload(siteInfo?.branding) ? siteInfo.branding : {}),
    [siteInfo?.branding]
  );
  const activeBanner = activeBranding?.banners?.welcome || bannerImage;

  const gameCatalog = useMemo(() => {
    const catalog = Array.isArray(siteInfo?.gameCatalog)
      ? siteInfo.gameCatalog
      : [];

    if (catalog.length > 0) return catalog;

    return FALLBACK_GAME_ORDER.map((key) => ({
      key,
      title: key,
    }));
  }, [siteInfo?.gameCatalog]);

  const featuredGames = useMemo(() => {
    const catalogMap = new Map(gameCatalog.map((game) => [game.key, game]));
    return FEATURED_GAME_KEYS.map(
      (key) => catalogMap.get(key) || { key, title: key }
    );
  }, [gameCatalog]);

  const carouselSlides = useMemo(() => {
    const activeCarouselBanners =
      activeBranding?.carousel || activeBranding?.banners?.carousel || [];

    if (Array.isArray(activeCarouselBanners) && activeCarouselBanners.length > 0) {
      const customSlides = activeCarouselBanners
        .filter((banner) => banner.url)
        .map((banner, index) => ({
          id: banner.id || banner._id || `custom-${index}`,
          url: banner.url,
          eyebrow:
            banner.eyebrow || PROMO_SLIDES[index % PROMO_SLIDES.length].eyebrow,
          title: banner.title || PROMO_SLIDES[index % PROMO_SLIDES.length].title,
          description:
            banner.description ||
            PROMO_SLIDES[index % PROMO_SLIDES.length].description,
        }));

      if (customSlides.length > 0) return customSlides;
    }

    return PROMO_SLIDES;
  }, [activeBranding]);

  if (user && user.loggedIn) {
    return <Navigate to="/play" />;
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Box
        sx={{
          width: "100%",
          overflow: "hidden",
          color: "text.primary",
          background:
            "linear-gradient(180deg, #0b1115 0%, #111a20 48%, #0f141a 100%)",
          ...WELCOME_ANIMATION_STYLES,
        }}
      >
        <Box
          component="section"
          sx={{
            position: "relative",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "#0b1115",
            "&:before": {
              content: '""',
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(105deg, rgba(11,17,21,0.98), rgba(11,17,21,0.9) 42%, rgba(11,17,21,0.58)), url(${activeBanner})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            },
          }}
        >
          <Container
            maxWidth={false}
            sx={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: "1500px",
              px: { xs: 1.25, md: 2 },
              py: { xs: 1.25, md: 1.5 },
            }}
          >
            <Stack spacing={1}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1}
                sx={{ alignItems: "stretch" }}
              >
                <Box
                  sx={{
                    flex: "1 1 58%",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    minHeight: { xs: 342, lg: 0 },
                  }}
                >
                  <PromoCarousel
                    slides={carouselSlides}
                    showArrows={!isPhoneDevice}
                  />
                  <PromoSupportPanel />
                </Box>

                <Stack
                  spacing={1}
                  sx={{
                    flex: "1 1 42%",
                    p: { xs: 1.25, md: 1.75 },
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.1)",
                    backgroundColor: "rgba(15,23,28,0.92)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 20px 70px rgba(0,0,0,0.3)",
                    ...entranceSx(90),
                  }}
                >
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    <Chip
                      icon={<ShieldOutlinedIcon />}
                      label="Skill games"
                      color="secondary"
                      size="small"
                    />
                    <Chip label="Cash-prize formats" variant="outlined" size="small" />
                    <Chip label="Live chat" variant="outlined" size="small" />
                    <Chip label="Make friends" variant="outlined" size="small" />
                  </Stack>

                  <Box>
                    <Typography
                      component="h1"
                      sx={{
                        fontSize: { xs: "2.2rem", md: "3.45rem" },
                        lineHeight: 0.98,
                        fontWeight: 900,
                        letterSpacing: 0,
                      }}
                    >
                      PassionMafia
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ maxWidth: 620, mt: 0.75 }}
                    >
                      Browse social games, party rounds, cards, dice, and
                      eligible cash-prize formats from one fast lobby. Chat in
                      real time, make friends at the table, and play for the
                      moments worth running back.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                    <Button
                      component={Link}
                      to="/play"
                      size="large"
                      variant="contained"
                      startIcon={<PlayArrowRoundedIcon />}
                      sx={{
                        minHeight: 44,
                        color: "#11161a",
                        backgroundColor: "#f5b94f",
                        boxShadow: "none",
                        animation: "welcomeGlow 3.6s ease-in-out infinite",
                        transition:
                          "transform 160ms ease, background-color 160ms ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          backgroundColor: "#ffcb69",
                          boxShadow: "none",
                        },
                      }}
                    >
                      Enter lobby
                    </Button>
                    <Button
                      type="button"
                      size="large"
                      variant="outlined"
                      startIcon={<PlayArrowRoundedIcon />}
                      onClick={() => setAuthDialogOpen(true)}
                      sx={{
                        minHeight: 44,
                        transition:
                          "transform 160ms ease, border-color 160ms ease, background-color 160ms ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      Play now
                    </Button>
                  </Stack>

                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {CATEGORY_ITEMS.map((item) => (
                      <CategoryButton key={item.label} item={item} />
                    ))}
                  </Stack>

                  <Grid2 container spacing={0.75}>
                    {TRUST_ITEMS.map((item, index) => (
                      <Grid2 key={item.title} size={{ xs: 12, md: 4, lg: 12 }}>
                        <TrustCard item={item} index={index} />
                      </Grid2>
                    ))}
                  </Grid2>
                </Stack>
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container
          maxWidth={false}
          sx={{
            width: "100%",
            maxWidth: "1500px",
            px: { xs: 1.25, md: 2 },
            py: { xs: 1, md: 1.25 },
          }}
        >
          <Stack
            spacing={1}
            sx={{
              p: { xs: 1.25, md: 1.5 },
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "background.paper",
              ...entranceSx(300),
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={0.75}
              sx={{
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h2">Featured games</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a format, open the lobby, and find your next table.
                </Typography>
              </Box>
              <Button
                component={Link}
                to="/play"
                variant="outlined"
                size="small"
                endIcon={<KeyboardArrowRightRoundedIcon />}
              >
                View lobby
              </Button>
            </Stack>

            <Grid2 container spacing={0.75}>
              {featuredGames.map((game, index) => (
                <Grid2 key={game.key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <GameCard game={game} index={index} />
                </Grid2>
              ))}
            </Grid2>
          </Stack>
        </Container>
      </Box>
      <Auth
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        defaultTab={0}
        asDialog={true}
      />
    </>
  );
};

export default Welcome;
