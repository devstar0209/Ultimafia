import React, { useState, useEffect, useContext, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { UserContext, SiteInfoContext } from "Contexts";
import { ClientSocket as Socket } from "../../../Socket";
import { PageNav } from "components/Nav";
import { useErrorAlert } from "components/Alerts";
import { camelCase } from "../../../utils";
import Comments from "../../Community/Comments";
import "css/join.css";
import { RefreshButton } from "./RefreshButton";
import { Loading } from "components/Loading";
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid2,
  ListItem,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import { useLoading } from "../../../hooks/useLoading";
import { GameRow } from "./GameRow";
import { RecentlyPlayedSetups } from "./RecentlyPlayedSetups";
import { RecentForumReplies } from "components/RecentForumReplies";
import { Poll } from "components/Poll";
import RecentTradesFeed from "components/RecentTradesFeed";
import Chat from "../../Chat/Chat";
import { FeaturedSetup } from "./FeaturedSetup";
import { DailyChallenges } from "./DailyChallengeDisplay";
import { getRowStubColor } from "./gameRowColors.js";
import GameIcon from "components/GameIcon";

const LOBBY_GAMES_PER_PAGE = 6;

function getLobbySocketURL() {
  if (import.meta.env.REACT_APP_USE_PORT === "true") {
    const lobbyPort =
      import.meta.env.REACT_APP_LOBBY_PORT || "2998";

    return `${import.meta.env.REACT_APP_SOCKET_PROTOCOL}://${
      import.meta.env.REACT_APP_SOCKET_URI
    }:${lobbyPort}`;
  }

  return `${import.meta.env.REACT_APP_SOCKET_PROTOCOL}://${
    import.meta.env.REACT_APP_SOCKET_URI
  }/lobbySocket`;
}

export default function LobbyBrowser() {
  const theme = useTheme();
  const siteInfo = useContext(SiteInfoContext);
  const gameCatalog = siteInfo?.gameCatalog || [];
  const defaultGameType = gameCatalog[0]?.key || "Mafia";
  const [openGamesCounts, setOpenGamesCounts] = useState({});
  const [refreshTimeoutId, setRefreshTimeoutId] = useState(null);
  const [refreshButtonIsSpinning, setRefreshButtonIsSpinning] = useState(false);
  const [hasOneOpenUrankedGame, setHasOneOpenUrankedGame] = useState(false);
  const [hasOneOpenGame, setHasOneOpenGame] = useState(false);
  const [listType, setListType] = useState("All");
  const [page, setPage] = useState(1);
  const [games, setGames] = useState([]);
  const { loading, setLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const lobbySocketRef = useRef(null);
  const pendingLobbyCallbackRef = useRef(null);
  const lobbyViewRef = useRef({ listType, page });
  const gamesRef = useRef(games);

  const user = useContext(UserContext);
  const errorAlert = useErrorAlert();
  const params = new URLSearchParams(location.search);
  const [selectedGameType, setSelectedGameType] = useState(
    params.get("game") ||
      localStorage.getItem("lobbyGameType") ||
      defaultGameType
  );
  const selectedGameTypeRef = useRef(selectedGameType);

  const glowingHostButton = user.canPlayRanked
    ? !hasOneOpenGame
    : !hasOneOpenUrankedGame;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
    };
  }, [refreshTimeoutId]);

  useEffect(() => {
    lobbyViewRef.current = { listType, page };
  }, [listType, page]);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    selectedGameTypeRef.current = selectedGameType;
  }, [selectedGameType]);

  useEffect(() => {
    const lobbySocket = new Socket(getLobbySocketURL(), true);
    lobbySocketRef.current = lobbySocket;

    lobbySocket.on("connected", () => {
      requestLobbyData(listType, page, null, { silent: true });

      if (user.loggedIn) {
        axios
          .get("/api/game/lobby/connect")
          .then(({ data }) => lobbySocket.send("auth", data))
          .catch(() => {});
      }
    });

    lobbySocket.on("lobbyData", (payload) => {
      const lobbyGames = payload.games || [];

      if (payload.gameType !== selectedGameTypeRef.current) return;

      setOpenGamesCounts(payload.openGamesCounts || {});
      setHasOneOpenGame(Boolean(payload.hasOneOpenGame));
      setHasOneOpenUrankedGame(Boolean(payload.hasOneOpenUrankedGame));

      if (lobbyGames.length > 0 || payload.page === 1) {
        setListType(payload.listType || "All");
        setPage(payload.page || 1);
        setGames(lobbyGames);
      }

      if (isMountedRef.current) {
        setLoading(false);
      }

      if (pendingLobbyCallbackRef.current) {
        pendingLobbyCallbackRef.current();
        pendingLobbyCallbackRef.current = null;
      }
    });

    lobbySocket.on("error", (error) => {
      if (error) errorAlert(error);
    });

    return () => {
      if (lobbySocketRef.current === lobbySocket) {
        lobbySocketRef.current = null;
      }

      lobbySocket.clear();
    };
  }, [user.loggedIn]);

  function getLobbyCursor(_page) {
    const currentGames = gamesRef.current;
    const currentView = lobbyViewRef.current;

    if (_page === 1) return { last: "Infinity" };
    if (_page < currentView.page && currentGames.length !== 0) {
      return { first: currentGames[0].endTime };
    }
    if (_page >= currentView.page && currentGames.length !== 0) {
      return { last: currentGames[currentGames.length - 1].endTime };
    }

    return null;
  }

  function requestLobbyData(
    _listType,
    _page,
    finallyCallback = null,
    options = {}
  ) {
    const { silent = false } = options;
    const socket = lobbySocketRef.current;
    const cursor = getLobbyCursor(_page);

    if (!cursor || !socket || socket.readyState >= 2) {
      if (finallyCallback) finallyCallback();
      return false;
    }

    if (!silent) {
      setLoading(true);
    }

    pendingLobbyCallbackRef.current = finallyCallback;
    socket.send("watchLobby", {
      list: camelCase(_listType),
      listType: _listType,
      lobby: "All",
      gameType: selectedGameTypeRef.current,
      page: _page,
      pageSize: LOBBY_GAMES_PER_PAGE,
      ...cursor,
    });

    return true;
  }

  useEffect(() => {
    const gameKeys = gameCatalog.map(g => g.key);
    const safeGameType = gameKeys.includes(selectedGameType)
      ? selectedGameType
      : defaultGameType;

    if (safeGameType !== selectedGameType) {
      setSelectedGameType(safeGameType);
      return;
    }

    localStorage.setItem("lobbyGameType", safeGameType);

    if (params.get("game") !== safeGameType) {
      navigate(location.pathname + `?game=${encodeURIComponent(safeGameType)}`, {
        replace: true,
      });
    }

    document.title = `🔪 PassionMafia Lobby`;
    setHasOneOpenGame(false);
    setHasOneOpenUrankedGame(false);
    getGameList(listType, 1);
  }, [location.pathname, selectedGameType]);

  const getGameList = async (
    _listType,
    _page,
    finallyCallback = null,
    options = {}
  ) => {
    requestLobbyData(_listType, _page, finallyCallback, options);
  };

  const refreshGames = async () => {
    if (!isMountedRef.current) return;

    window.gtag("event", "refreshing_games_hehe", {
      gayness: Math.random(),
    });
    // This is a nice trick to allow spam-clicking the Refresh button
    setRefreshButtonIsSpinning(false);
    await new Promise((res) => setTimeout(res));
    if (!isMountedRef.current) return;
    setRefreshButtonIsSpinning(true);

    if (refreshTimeoutId) {
      clearTimeout(refreshTimeoutId);
    }

    const callback = async () => {
      // The animation is so beautifulâ€¦ It must keep spinning! (although the games have already been refreshed)
      const minAnimationTime = 100;
      await new Promise((res) => {
        const timeoutId = setTimeout(res, minAnimationTime);
        if (isMountedRef.current) {
          setRefreshTimeoutId(timeoutId);
        }
      });
      // "But bro, this is bad UX - don't leave users hanging" nah, 100ms is short enough
      if (isMountedRef.current) {
        setRefreshButtonIsSpinning(false);
      }
    };
    getGameList(listType, page, callback);
  };

  const showOpenGames = () => {
    getGameList("Open", 1);
  };

  if (!user.loaded) return <Loading small />;
  // Allow logged-out users to access LobbyBrowser

  const selectedGameMeta =
    gameCatalog.find((game) => game.key === selectedGameType) ||
    gameCatalog[0] ||
    {};
  const selectedOpenCount = openGamesCounts[selectedGameType] || 0;
  const totalOpenCount = Object.values(openGamesCounts).reduce(
    (total, count) => total + count,
    0
  );
  const panelSx = {
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    background:
      theme.palette.mode === "dark"
        ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))"
        : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 18px 48px rgba(0, 0, 0, 0.24)"
        : "0 18px 48px rgba(33, 43, 54, 0.12)",
    overflow: "hidden",
  };

  const gameCategoryPanel = (
    <Paper sx={{ ...panelSx, p: 1 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.75,
        }}
      >
        <Typography variant="h3" color="primary">
          Library
        </Typography>
        <Chip
          size="small"
          icon={<SportsEsportsRoundedIcon />}
          label={totalOpenCount}
          color="secondary"
          sx={{ borderRadius: 1, fontWeight: 800 }}
        />
      </Stack>
      <Divider sx={{ mb: 1 }} />
      <Stack spacing={0.75}>
        {gameCatalog.map((game) => (
          <Box
            key={`game-category-${game.key}`}
            component="button"
            onClick={() => setSelectedGameType(game.key)}
            sx={{
              width: "100%",
              border: 1,
              borderColor:
                selectedGameType === game.key ? "primary.main" : "divider",
              borderRadius: 1,
              px: 1.25,
              py: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              backgroundColor:
                selectedGameType === game.key
                  ? "rgba(var(--mui-palette-primary-mainChannel) / 0.14)"
                  : "transparent",
              color: "text.primary",
              transition:
                "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                backgroundColor: "action.hover",
                transform: "translateY(-1px)",
              },
            }}
          >
            <GameIcon gameType={game.key} size={34} circular />
            <Stack
              direction="column"
              sx={{
                minWidth: 0,
                flex: 1,
                textAlign: "left",
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                {game.title}
              </Typography>
              {Number(game.coins || 0) > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                    color: "warning.main",
                    lineHeight: 1,
                    marginTop: "5px",
                  }}
                >
                  <i
                    className="fas fa-coins"
                    style={{
                      fontSize: "0.75rem",
                    }}
                  />
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: "inherit",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {Number(game.coins || 0).toLocaleString()}
                  </Typography>
                </Stack>
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                borderRadius: 1,
                px: 0.75,
                py: 0.35,
                backgroundColor:
                  selectedGameType === game.key
                    ? "primary.main"
                    : "rgba(var(--mui-palette-secondary-mainChannel) / 0.22)",
                color: "white",
                minWidth: "28px",
                textAlign: "center",
                fontWeight: 800,
              }}
            >
              {openGamesCounts[game.key] || 0}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );

  const gameList = loading ? (
    <Box sx={{ py: 5 }}>
      <Loading small />
    </Box>
  ) : games.length ? (
    <Stack direction="column" spacing={1.25}>
      {games.map((game) => {
        return (
          <ListItem
            disablePadding
            key={game.id}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              backgroundColor: "background.paper",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 10px 30px rgba(0, 0, 0, 0.22)"
                  : "0 10px 30px rgba(33, 43, 54, 0.1)",
            }}
          >
            <Box
              className={game.competitive ? "metallic-gold" : undefined}
              sx={{
                backgroundColor: getRowStubColor(game),
                alignSelf: "stretch",
                minWidth: "8px",
              }}
            />
            <GameRow
              game={game}
              refresh={() => getGameList(listType, page)}
              odd={games.indexOf(game) % 2 === 1}
              key={game.id}
              showGameTypeIcon
              showGameState
            />
          </ListItem>
        );
      })}
    </Stack>
  ) : (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        py: 6,
        px: 2,
        textAlign: "center",
        backgroundColor: "rgba(var(--mui-palette-primary-mainChannel) / 0.05)",
      }}
    >
      <SportsEsportsRoundedIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
      <Typography variant="h3" color="primary">
        No live rooms
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        No open {selectedGameMeta.title || selectedGameType} games are listed
        right now.
      </Typography>
      {user.loggedIn && (
        <Button
          variant="contained"
          size="small"
          onClick={() =>
            navigate(`/play/host?game=${encodeURIComponent(selectedGameType)}`)
          }
          startIcon={<SportsEsportsRoundedIcon />}
          sx={{ mt: 2 }}
        >
          Host
        </Button>
      )}
    </Paper>
  );

  const buttons = (
    <Paper sx={{ ...panelSx, p: 1.25 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        sx={{
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <PageNav page={page} onNav={(page) => getGameList(listType, page)} />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            justifyContent: "center",
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" color="primary" noWrap>
              Live Rooms
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <div onClick={refreshGames}>
            <RefreshButton isSpinning={refreshButtonIsSpinning} />
          </div>
        </Stack>
      </Stack>
    </Paper>
  );

  return (
    <Box
      sx={{
        pt: 3,
        pb: 4,
        px: { xs: 1, sm: 2 },
      }}
    >
      <Stack spacing={2}>
        <Paper
          sx={{
            ...panelSx,
            p: { xs: 2, md: 2.5 },
            background:
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.2), rgba(255,255,255,0.045) 45%, rgba(var(--mui-palette-secondary-mainChannel) / 0.16))"
                : "linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.16), rgba(255,255,255,0.86) 45%, rgba(var(--mui-palette-secondary-mainChannel) / 0.16))",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <GameIcon gameType={selectedGameType} size={58} circular />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h2" noWrap>
                  {selectedGameMeta.title || selectedGameType}
                </Typography>
                <Typography color="text.secondary">
                  Browse live rooms, jump into a table, or host a fresh match.
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                justifyContent: { xs: "flex-start", md: "flex-end" },
              }}
            >
              <Chip
                icon={<BoltRoundedIcon />}
                label={`${selectedOpenCount} open`}
                color="primary"
                onClick={showOpenGames}
                sx={{ borderRadius: 1, fontWeight: 800 }}
              />
              <Chip
                icon={<GroupsRoundedIcon />}
                label={`${totalOpenCount} total`}
                color="secondary"
                sx={{ borderRadius: 1, fontWeight: 800 }}
              />
              {user.loggedIn && (
                <Button
                  variant="contained"
                  onClick={() =>
                    navigate(
                      `/play/host?game=${encodeURIComponent(selectedGameType)}`
                    )
                  }
                  startIcon={<SportsEsportsRoundedIcon />}
                >
                  Host
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      <Grid2 container rowSpacing={2} columnSpacing={2}>
        <Grid2 size={{ xs: 12, md: 2.5 }}>
          <Stack spacing={1}>
            {gameCategoryPanel}
          </Stack>
        </Grid2>
        <Grid2 size={{ xs: 12, md: 5.5 }}>
          <Stack spacing={2}>
            <Stack direction="column" spacing={1.25}>
              {buttons}
              {gameList}
            </Stack>
            <Comments fullWidth location="lobby" />
          </Stack>
        </Grid2>
        <Grid2 size={{ xs: 12, md: 4 }}>
          <Stack spacing={1}>
            <FeaturedSetup
              lobby="All"
              glowingHostButton={glowingHostButton}
            />
            <DailyChallenges />
            <RecentlyPlayedSetups lobby="All" />
            <RecentForumReplies />
            <Chat />
            <Poll lobby="All" />
            <RecentTradesFeed />
          </Stack>
        </Grid2>
      </Grid2>
      </Stack>
    </Box>
  );
}
