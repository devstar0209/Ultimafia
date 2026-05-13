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
import { Link, Navigate } from "react-router-dom";
import "css/main.css";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from "react-responsive-carousel";
import { getGameIconSrc } from "../../components/GameIcon";
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

const GAME_WELCOME_CONTENT = {
  Mafia: {
    tileDescription: "Classic social deduction",
    headline: "Read the table, sell the story, survive the vote.",
    description:
      "Community-hosted Mafia with casual rooms, competitive setups, role madness, and a deep catalog of custom rules.",
    meta: "8-24 players",
    pace: "Social",
    accent: "#ff8c42",
  },
  Resistance: {
    tileDescription: "Hidden spies and missions",
    headline: "Build teams, vote, and expose the spies.",
    description:
      "Rebels complete missions while hidden spies sabotage from inside the table. Every vote leaves a trail.",
    meta: "5-10 players",
    pace: "Tactical",
    accent: "#5fd1c7",
  },
  Jotto: {
    tileDescription: "Word deduction duel",
    headline: "Crack the word before your opponent does.",
    description:
      "A tight logic duel where every guess reveals overlap clues and narrows the hidden word.",
    meta: "2 players",
    pace: "Logic",
    accent: "#74b9ff",
  },
  Acrotopia: {
    tileDescription: "Creative backronym battles",
    headline: "Turn acronyms into sharp answers.",
    description:
      "Write the best backronym, vote for favorites, and keep the room laughing through fast rounds.",
    meta: "3-12 players",
    pace: "Party",
    accent: "#ff6f61",
  },
  "Secret Dictator": {
    tileDescription: "Policy drafting and deception",
    headline: "Pass policies while hunting the hidden bloc.",
    description:
      "Elect governments, draw policy cards, bluff your alignment, and stop the table from tipping too far.",
    meta: "5-10 players",
    pace: "Bluffing",
    accent: "#c77918",
  },
  "Wacky Words": {
    tileDescription: "Party prompts and votes",
    headline: "Write the answer that wins the room.",
    description:
      "Prompt-driven party modes built for jokes, voting, and quick rematches with friends.",
    meta: "3-16 players",
    pace: "Creative",
    accent: "#9df0e8",
  },
  "Liars Dice": {
    tileDescription: "Bluff, bid, and challenge",
    headline: "Call bluffs at the exact right moment.",
    description:
      "Only you see your dice. Push the bid, read the table, and challenge before the odds collapse.",
    meta: "2-8 players",
    pace: "Bluffing",
    accent: "#6dd3a0",
  },
  "Texas Hold Em": {
    tileDescription: "Poker tables online",
    headline: "Bet smart and build the best hand.",
    description:
      "Classic community-card poker with chip betting, table pressure, and clean online pacing.",
    meta: "2-9 players",
    pace: "Cards",
    accent: "#edb334",
  },
  Cheat: {
    tileDescription: "Card bluffing chaos",
    headline: "Play the cards, or just say you did.",
    description:
      "Race to empty your hand while deciding when to bluff and when to punish someone else for it.",
    meta: "3-8 players",
    pace: "Cards",
    accent: "#ffb26f",
  },
  Ratscrew: {
    tileDescription: "Fast slap-card action",
    headline: "Watch patterns and claim the pile.",
    description:
      "A reaction card game where valid patterns, timing, and momentum decide who takes the stack.",
    meta: "2-8 players",
    pace: "Reflex",
    accent: "#d44b42",
  },
  Battlesnakes: {
    tileDescription: "Arena survival strategy",
    headline: "Outmaneuver every other snake.",
    description:
      "Collect food, predict movement, and take space on a shared grid until only one player remains.",
    meta: "2-8 players",
    pace: "Arena",
    accent: "#2f9e66",
  },
  "Connect Four": {
    tileDescription: "Classic four-in-a-row",
    headline: "Plan the drop that cannot be blocked.",
    description:
      "A polished version of the classic vertical board game with quick turns and readable threats.",
    meta: "2 players",
    pace: "Classic",
    accent: "#2878c7",
  },
  "Dice Wars": {
    tileDescription: "Territory conquest",
    headline: "Expand, reinforce, and roll for control.",
    description:
      "Turn-based territory pressure where connected borders, reinforcements, and risky attacks matter.",
    meta: "2-8 players",
    pace: "Strategy",
    accent: "#a178ff",
  },
};

const FALLBACK_GAME_ORDER = Object.keys(GAME_WELCOME_CONTENT);

const FALLBACK_CAROUSEL = [
  {
    id: "daily-rooms",
    url: welcomeSlideOne,
    title: "Daily Rooms",
    description: "Jump into social deduction, card tables, word games, and party modes from the same lobby.",
  },
  {
    id: "custom-setups",
    url: welcomeSlideTwo,
    title: "Custom Setups",
    description: "Tune game settings, host private matches, and bring back favorite formats.",
  },
  {
    id: "competitive",
    url: welcomeSlideThree,
    title: "Competitive Play",
    description: "Track points, play ranked setups, and follow the community metagame.",
  },
  {
    id: "community",
    url: welcomeSlideFour,
    title: "Community Hub",
    description: "Forums, events, cosmetics, and long-running profiles keep the table alive between games.",
  },
];

const PLATFORM_STATS = [
  { value: "13", label: "Game types" },
  { value: "250+", label: "Mafia roles" },
  { value: "24/7", label: "Community lobbies" },
];

const FEATURED_QUEUE = [
  { gameType: "Mafia", label: "Ranked Standard", status: "Recruiting", players: "9/15" },
  { gameType: "Resistance", label: "Spyfall Night", status: "Open", players: "5/8" },
  { gameType: "Wacky Words", label: "Prompt Party", status: "Starting soon", players: "7/12" },
];

const FEATURE_PANELS = [
  {
    icon: "fas fa-sliders-h",
    title: "Flexible hosting",
    description: "Use official presets or configure settings for private groups, ranked nights, and quick casual games.",
  },
  {
    icon: "fas fa-trophy",
    title: "Progress that matters",
    description: "Profiles, points, achievements, cosmetics, and competitive ladders give regulars long-term goals.",
  },
  {
    icon: "fas fa-comments",
    title: "Built around the table",
    description: "Chat, forums, announcements, and community tools keep players connected before and after each match.",
  },
];

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
  const [carouselBanners, setCarouselBanners] = useState([]);
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
              } catch (parseErr) {
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

  useEffect(() => {
    const carouselBannersFromContext = siteInfo?.branding?.banners?.carousel || [];
    setCarouselBanners(carouselBannersFromContext);
  }, [siteInfo?.branding?.banners?.carousel]);

  const activeBanner = siteInfo?.branding?.banners?.welcome || bannerImage;
  const gameCatalog = useMemo(() => {
    const catalog = Array.isArray(siteInfo?.gameCatalog) ? siteInfo.gameCatalog : [];
    if (catalog.length > 0) return catalog;

    return FALLBACK_GAME_ORDER.map((key) => ({
      key,
      title: key,
    }));
  }, [siteInfo?.gameCatalog]);
  const carouselSlides = carouselBanners.length > 0
    ? carouselBanners.map((banner, index) => ({
        id: banner.id || banner._id || `custom-${index}`,
        url: banner.url,
        title: banner.title || FALLBACK_CAROUSEL[index % FALLBACK_CAROUSEL.length].title,
        description:
          banner.description ||
          FALLBACK_CAROUSEL[index % FALLBACK_CAROUSEL.length].description,
      }))
    : FALLBACK_CAROUSEL;
  const highlightedGames = gameCatalog.slice(0, 6);
  const catalogGames = gameCatalog.slice(0, 12);

  if (user && user.loggedIn) {
    return <Navigate to="/play" />;
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Box
      sx={{
        width: "100%",
        overflow: "hidden",
        color: "text.primary",
      }}
    >
      <Box
        component="section"
        sx={{
          position: "relative",
          minHeight: { xs: "calc(100vh - 210px)", md: "calc(100vh - 170px)" },
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "#0f141a",
          "&:before": {
            content: '""',
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(90deg, rgba(15,20,26,0.98) 0%, rgba(15,20,26,0.82) 44%, rgba(15,20,26,0.2) 100%), url(${activeBanner})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          },
          "&:after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(95,209,199,0.12) 0%, rgba(255,140,66,0.07) 42%, rgba(15,20,26,0.96) 100%)",
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
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 420px" },
            gap: { xs: 4, lg: 5 },
            alignItems: "center",
            py: { xs: 5, md: 7 },
            px: { xs: 2, md: 5 },
          }}
        >
          <Stack spacing={3} sx={{ maxWidth: 760 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip label="Browser-based party games" color="secondary" />
              <Chip label="No download" variant="outlined" />
            </Stack>
            <Box>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "2.4rem", sm: "3.4rem", md: "4.5rem" },
                  lineHeight: 0.95,
                  fontWeight: 900,
                  letterSpacing: 0,
                  maxWidth: 720,
                }}
              >
                PassionMafia
              </Typography>
              <Typography
                variant="h2"
                component="p"
                sx={{
                  mt: 1.5,
                  maxWidth: 650,
                  color: "rgba(215, 222, 229, 0.86)",
                  fontSize: { xs: "1.15rem", md: "1.55rem" },
                  lineHeight: 1.35,
                  textTransform: "none",
                }}
              >
                A modern game lobby for social deduction, bluffing, word games,
                cards, and tabletop-style strategy.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Button component={Link} to="/play" size="large">
                Browse lobbies
              </Button>
              <Button component={Link} to="/learn/games" size="large" variant="outlined">
                Explore games
              </Button>
            </Stack>
            <Grid2 container spacing={1.5} sx={{ maxWidth: 620 }}>
              {PLATFORM_STATS.map((stat) => (
                <Grid2 key={stat.label} size={{ xs: 4 }}>
                  <Box
                    sx={{
                      borderTop: "1px solid rgba(255,255,255,0.16)",
                      pt: 1.25,
                    }}
                  >
                    <Typography variant="h2" sx={{ lineHeight: 1 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                </Grid2>
              ))}
            </Grid2>
          </Stack>

          <Box
            sx={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 2,
              backgroundColor: "rgba(22, 33, 43, 0.76)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.38)",
              overflow: "hidden",
            }}
          >
            <Stack spacing={0} divider={<Box sx={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h3">Featured rooms</Typography>
                <Typography variant="body2" color="text.secondary">
                  Popular ways to jump into the community lobby.
                </Typography>
              </Box>
              {FEATURED_QUEUE.map((item) => {
                const content = GAME_WELCOME_CONTENT[item.gameType] || {};
                return (
                  <Box
                    key={`${item.gameType}-${item.label}`}
                    sx={{
                      p: 1.5,
                      display: "grid",
                      gridTemplateColumns: "46px minmax(0, 1fr) auto",
                      gap: 1.25,
                      alignItems: "center",
                    }}
                  >
                    <Box
                      component="img"
                      src={getGameIconSrc(
                        item.gameType,
                        siteInfo?.branding?.gameLogos,
                        siteInfo?.gameCatalogMap
                      )}
                      alt=""
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: `2px solid ${content.accent || "#ff8c42"}`,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h4" noWrap>
                        {item.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.gameType} · {item.status}
                      </Typography>
                    </Box>
                    <Chip label={item.players} size="small" />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Container>
      </Box>

      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          maxWidth: "1500px",
          px: { xs: 2, md: 5 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Grid2 container spacing={2.5} sx={{ alignItems: "stretch" }}>
          <Grid2 size={{ xs: 12, lg: 7 }}>
            <Box
              sx={{
                height: "100%",
                minHeight: { xs: 360, md: 520 },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                backgroundColor: "background.paper",
                "& .carousel, & .slider-wrapper, & .slider, & .slide": {
                  height: "100%",
                },
                "& .carousel .control-dots": {
                  m: 0,
                  p: 1.5,
                  textAlign: "left",
                  left: 16,
                  width: "auto",
                },
              }}
            >
              <Carousel
                showArrows={!isPhoneDevice}
                showStatus={false}
                showThumbs={false}
                infiniteLoop
                autoPlay
                interval={5200}
                transitionTime={600}
                swipeable
                emulateTouch
                dynamicHeight={false}
                useKeyboardArrows
                renderIndicator={(onClickHandler, isSelected, index, label) => (
                  <button
                    type="button"
                    onClick={onClickHandler}
                    style={{
                      background: isSelected ? "#ff8c42" : "rgba(255,255,255,0.42)",
                      border: "none",
                      width: isSelected ? 26 : 10,
                      height: 10,
                      borderRadius: 10,
                      margin: "0 4px",
                      padding: 0,
                      cursor: "pointer",
                      transition: "width 180ms ease, background 180ms ease",
                    }}
                    aria-label={`${label} ${index + 1}`}
                  />
                )}
              >
                {carouselSlides.map((slide) => (
                  <Box
                    key={slide.id}
                    sx={{
                      position: "relative",
                      height: { xs: 360, md: 520 },
                      textAlign: "left",
                      backgroundColor: "#0f141a",
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
                      }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, rgba(15,20,26,0.92), rgba(15,20,26,0.5) 52%, rgba(15,20,26,0.08))",
                      }}
                    />
                    <Stack
                      spacing={1.5}
                      sx={{
                        position: "absolute",
                        left: { xs: 20, md: 32 },
                        right: { xs: 20, md: "42%" },
                        bottom: { xs: 54, md: 56 },
                      }}
                    >
                      <Typography variant="h2">{slide.title}</Typography>
                      <Typography variant="body1" sx={{ color: "rgba(215,222,229,0.86)" }}>
                        {slide.description}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Carousel>
            </Box>
          </Grid2>

          <Grid2 size={{ xs: 12, lg: 5 }}>
            <Stack spacing={2} sx={{ height: "100%" }}>
              <Box>
                <Typography variant="h2">Featured game styles</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                  Pick the pace you want tonight, from long-form social reads to fast party rounds.
                </Typography>
              </Box>
              <Grid2 container spacing={1.25}>
                {highlightedGames.map((game) => {
                  const key = game.key;
                  const content = GAME_WELCOME_CONTENT[key] || GAME_WELCOME_CONTENT.Mafia;
                  return (
                    <Grid2 key={`featured-${key}`} size={{ xs: 12, sm: 6 }}>
                      <Box
                        sx={{
                          minHeight: 154,
                          height: "100%",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          p: 1.5,
                          background:
                            "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
                          position: "relative",
                          overflow: "hidden",
                          "&:before": {
                            content: '""',
                            position: "absolute",
                            inset: "auto -20px -42px auto",
                            width: 116,
                            height: 116,
                            backgroundColor: content.accent,
                            opacity: 0.12,
                            borderRadius: "50%",
                          },
                        }}
                      >
                        <Stack spacing={1} sx={{ position: "relative" }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Box
                              component="img"
                              src={getGameIconSrc(
                                key,
                                siteInfo?.branding?.gameLogos,
                                siteInfo?.gameCatalogMap
                              )}
                              alt=""
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 1.5,
                                objectFit: "contain",
                              }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="h4" noWrap>
                                {game.title || key}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {content.tileDescription}
                              </Typography>
                            </Box>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {content.headline}
                          </Typography>
                          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                            <Chip label={content.meta} size="small" variant="outlined" />
                            <Chip label={content.pace} size="small" />
                          </Stack>
                        </Stack>
                      </Box>
                    </Grid2>
                  );
                })}
              </Grid2>
            </Stack>
          </Grid2>
        </Grid2>
      </Container>

      <Box
        component="section"
        sx={{
          borderBlock: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(22,33,43,0.42)",
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            maxWidth: "1500px",
            px: { xs: 2, md: 5 },
            py: { xs: 4, md: 5 },
          }}
        >
          <Grid2 container spacing={1.5}>
            {FEATURE_PANELS.map((feature) => (
              <Grid2 key={feature.title} size={{ xs: 12, md: 4 }}>
                <Stack
                  spacing={1}
                  sx={{
                    height: "100%",
                    p: 2,
                    borderLeft: "3px solid",
                    borderColor: "secondary.main",
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Box
                    component="i"
                    className={feature.icon}
                    sx={{ color: "primary.main", fontSize: "1.3rem" }}
                  />
                  <Typography variant="h3">{feature.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Stack>
              </Grid2>
            ))}
          </Grid2>
        </Container>
      </Box>

      <Container
        maxWidth={false}
        sx={{
          maxWidth: "1500px",
          px: { xs: 2, md: 5 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "end" } }}
          >
            <Box>
              <Typography variant="h2">Game catalog</Typography>
              <Typography variant="body2" color="text.secondary">
                A cleaner catalog view for the current site game list.
              </Typography>
            </Box>
            <Button component={Link} to="/learn/games" variant="outlined">
              Learn the rules
            </Button>
          </Stack>
          <Grid2 container spacing={1.25}>
            {catalogGames.map((game, index) => {
              const key = game.key;
              const content = GAME_WELCOME_CONTENT[key] || GAME_WELCOME_CONTENT.Mafia;
              return (
                <Grid2 key={`catalog-${key}`} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <Box
                    component={Link}
                    to={`/learn/games?game=${encodeURIComponent(key)}`}
                    sx={{
                      minHeight: 176,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      p: 1.25,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      backgroundColor: index % 2 === 0 ? "background.paper" : "rgba(255,255,255,0.025)",
                      color: "text.primary",
                      textDecoration: "none",
                      transition: "transform 160ms ease, border-color 160ms ease, background-color 160ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: content.accent,
                        backgroundColor: "action.hover",
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src={getGameIconSrc(
                        key,
                        siteInfo?.branding?.gameLogos,
                        siteInfo?.gameCatalogMap
                      )}
                      alt={`${game.title || key} icon`}
                      sx={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        minHeight: 0,
                        objectFit: "contain",
                        borderRadius: 1.5,
                        backgroundColor: "rgba(0,0,0,0.16)",
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h4" noWrap>
                        {game.title || key}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {content.pace} · {content.meta}
                      </Typography>
                    </Box>
                  </Box>
                </Grid2>
              );
            })}
          </Grid2>
        </Stack>
      </Container>
    </Box>
  );
};

export default Welcome;
