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

const DASHBOARD_STATS = [
  { value: "7", label: "Rooms open" },
  { value: "42", label: "Players active" },
  { value: "3", label: "New-player tables" },
];

const FEATURED_ROOMS = [
  {
    gameType: "Mafia",
    room: "Ranked Standard",
    host: "Community queue",
    status: "Recruiting",
    players: "9/15",
    tone: "Competitive",
    starts: "Starts when 15 join",
  },
  {
    gameType: "Resistance",
    room: "Spy Hunt",
    host: "Fast table",
    status: "Open",
    players: "5/8",
    tone: "Tactical",
    starts: "2 seats left",
  },
  {
    gameType: "Wacky Words",
    room: "Prompt Party",
    host: "Casual room",
    status: "Starting soon",
    players: "7/12",
    tone: "Party",
    starts: "Next round in 3 min",
  },
  {
    gameType: "Liars Dice",
    room: "Bluff Table",
    host: "Quick match",
    status: "Open",
    players: "4/8",
    tone: "Bluffing",
    starts: "Join anytime",
  },
];

const ACTIVITY_FEED = [
  "Ranked Mafia queue is filling",
  "New-player friendly rooms are highlighted",
  "Party games rotate through Wacky Words and Acrotopia",
  "Competitive formats are available from the lobby",
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
  const catalogGames = gameCatalog;
  const playableRooms = FEATURED_ROOMS.map((room) => ({
    ...room,
    title:
      gameCatalog.find((game) => game.key === room.gameType)?.title ||
      room.gameType,
  }));

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
        backgroundColor: "background.default",
      }}
    >
      <Box
        component="section"
        sx={{
          position: "relative",
          minHeight: { xs: "auto", lg: "calc(100vh - 58px)" },
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "#0f141a",
          "&:before": {
            content: '""',
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(180deg, rgba(15,20,26,0.88), rgba(15,20,26,0.98)), url(${activeBanner})`,
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
            maxWidth: "1540px",
            px: { xs: 1.5, md: 3 },
            py: { xs: 2, md: 3 },
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                  <Chip label="Lobby dashboard" color="secondary" size="small" />
                  <Chip label="Guest access" variant="outlined" size="small" />
                </Stack>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: "2rem", md: "2.7rem" },
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: 0,
                  }}
                >
                  Pick a table and start playing
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 650, mt: 0.75 }}
                >
                  Browse live-style rooms, choose a game type, or learn a ruleset before joining the community lobby.
                </Typography>
              </Box>

              <Grid2 container spacing={1} sx={{ minWidth: { md: 430 } }}>
                {DASHBOARD_STATS.map((stat) => (
                  <Grid2 key={stat.label} size={{ xs: 4 }}>
                    <Box
                      sx={{
                        height: "100%",
                        p: 1.25,
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 2,
                        backgroundColor: "rgba(22,33,43,0.72)",
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

            <Grid2 container spacing={1.5} sx={{ alignItems: "stretch" }}>
              <Grid2 size={{ xs: 12, lg: 7 }}>
                <Stack
                  spacing={1.25}
                  sx={{
                    height: "100%",
                    p: { xs: 1.25, md: 1.5 },
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 2,
                    backgroundColor: "rgba(22,33,43,0.82)",
                    backdropFilter: "blur(14px)",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Box>
                      <Typography variant="h2">Playable rooms</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Featured public tables and quick queues.
                      </Typography>
                    </Box>
                    <Button component={Link} to="/play" variant="outlined" size="small">
                      All lobbies
                    </Button>
                  </Stack>

                  <Grid2 container spacing={1}>
                    {playableRooms.map((room) => {
                      const content = GAME_WELCOME_CONTENT[room.gameType] || GAME_WELCOME_CONTENT.Mafia;
                      return (
                        <Grid2 key={`${room.gameType}-${room.room}`} size={{ xs: 12, md: 6 }}>
                          <Box
                            component={Link}
                            to={`/play?game=${encodeURIComponent(room.gameType)}`}
                            sx={{
                              minHeight: 156,
                              height: "100%",
                              display: "grid",
                              gridTemplateRows: "auto 1fr auto",
                              gap: 1,
                              p: 1.5,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                              backgroundColor: "rgba(15,20,26,0.62)",
                              color: "text.primary",
                              textDecoration: "none",
                              transition: "transform 160ms ease, border-color 160ms ease, background-color 160ms ease",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                borderColor: content.accent,
                                backgroundColor: "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                              <Box
                                component="img"
                                src={getGameIconSrc(
                                  room.gameType,
                                  siteInfo?.branding?.gameLogos,
                                  siteInfo?.gameCatalogMap
                                )}
                                alt=""
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 1.5,
                                  objectFit: "contain",
                                  backgroundColor: "rgba(0,0,0,0.22)",
                                  border: `1px solid ${content.accent}`,
                                }}
                              />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="h3" noWrap>
                                  {room.room}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {room.title} - {room.host}
                                </Typography>
                              </Box>
                              <Chip label={room.players} size="small" />
                            </Stack>

                            <Typography variant="body2" color="text.secondary">
                              {content.headline}
                            </Typography>

                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
                            >
                              <Chip label={room.status} size="small" color="secondary" />
                              <Chip label={room.tone} size="small" variant="outlined" />
                              <Typography variant="caption" color="text.secondary">
                                {room.starts}
                              </Typography>
                            </Stack>
                          </Box>
                        </Grid2>
                      );
                    })}
                  </Grid2>
                </Stack>
              </Grid2>

              <Grid2 size={{ xs: 12, lg: 5 }}>
                <Stack
                  spacing={1.25}
                  sx={{
                    height: "100%",
                    p: { xs: 1.25, md: 1.5 },
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 2,
                    backgroundColor: "rgba(22,33,43,0.82)",
                    backdropFilter: "blur(14px)",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Box>
                      <Typography variant="h2">Game catalog</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Choose the kind of table you want.
                      </Typography>
                    </Box>
                    <Button component={Link} to="/learn/games" variant="outlined" size="small">
                      Rules
                    </Button>
                  </Stack>

                  <Grid2 container spacing={1}>
                    {catalogGames.map((game, index) => {
                      const key = game.key;
                      const content = GAME_WELCOME_CONTENT[key] || GAME_WELCOME_CONTENT.Mafia;
                      const openRooms = (index % 4) + 1;
                      return (
                        <Grid2 key={`catalog-primary-${key}`} size={{ xs: 6, sm: 4, lg: 3 }}>
                          <Box
                            component={Link}
                            to={`/play?game=${encodeURIComponent(key)}`}
                            sx={{
                              minHeight: 118,
                              height: "100%",
                              p: 1,
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.75,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                              backgroundColor: "rgba(15,20,26,0.58)",
                              color: "text.primary",
                              textDecoration: "none",
                              transition: "transform 160ms ease, border-color 160ms ease, background-color 160ms ease",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                borderColor: content.accent,
                                backgroundColor: "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                              <Box
                                component="img"
                                src={getGameIconSrc(
                                  key,
                                  siteInfo?.branding?.gameLogos,
                                  siteInfo?.gameCatalogMap
                                )}
                                alt=""
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1,
                                  objectFit: "contain",
                                  backgroundColor: "rgba(0,0,0,0.18)",
                                }}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h4" noWrap>
                                  {game.title || key}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {content.pace}
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ mt: "auto", alignItems: "center", justifyContent: "space-between" }}
                            >
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {content.meta}
                              </Typography>
                              <Chip label={`${openRooms} open`} size="small" />
                            </Stack>
                          </Box>
                        </Grid2>
                      );
                    })}
                  </Grid2>
                </Stack>
              </Grid2>
            </Grid2>

            <Grid2 container spacing={1.5}>
              <Grid2 size={{ xs: 12, md: 8 }}>
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 2,
                    backgroundColor: "rgba(22,33,43,0.76)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography variant="h3">New here?</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Open the lobby as a guest, read a ruleset, then sign in when you are ready to save progress.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button component={Link} to="/play" size="small">
                        Enter lobby
                      </Button>
                      <Button component={Link} to="/learn/games" size="small" variant="outlined">
                        Learn first
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    height: "100%",
                    p: 1.5,
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 2,
                    backgroundColor: "rgba(22,33,43,0.76)",
                  }}
                >
                  <Typography variant="h3">Activity</Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {ACTIVITY_FEED.slice(0, 2).map((item) => (
                      <Typography key={item} variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              </Grid2>
            </Grid2>
          </Stack>
        </Container>
      </Box>

      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          maxWidth: "1540px",
          px: { xs: 1.5, md: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Grid2 container spacing={2} sx={{ alignItems: "stretch" }}>
          <Grid2 size={{ xs: 12, lg: 7 }}>
            <Box
              sx={{
                height: "100%",
                minHeight: { xs: 320, md: 420 },
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
                      height: { xs: 320, md: 420 },
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
              <Box
                sx={{
                  mt: "auto",
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: "background.paper",
                }}
              >
                <Typography variant="h3">Community board</Typography>
                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  {ACTIVITY_FEED.map((item) => (
                    <Typography key={item} variant="body2" color="text.secondary">
                      {item}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Grid2>
        </Grid2>
      </Container>
    </Box>
  );
};

export default Welcome;
