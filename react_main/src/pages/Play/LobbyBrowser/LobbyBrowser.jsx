import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { UserContext, SiteInfoContext } from "Contexts";
import { getPageNavFilterArg, PageNav } from "components/Nav";
import { useErrorAlert } from "components/Alerts";
import { camelCase } from "../../../utils";
import Comments from "../../Community/Comments";
import "css/join.css";
import { RefreshButton } from "./RefreshButton";
import { Loading } from "components/Loading";
import {
  Box,
  Button,
  Grid2,
  ListItem,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
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

  const user = useContext(UserContext);
  const errorAlert = useErrorAlert();
  const params = new URLSearchParams(location.search);
  const [selectedGameType, setSelectedGameType] = useState(
    params.get("game") ||
      localStorage.getItem("lobbyGameType") ||
      defaultGameType
  );

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
    getOpenGameCounts();
  }, [location.pathname, selectedGameType]);

  const getOpenGameCounts = useCallback(async () => {
    return axios.get(`/api/game/list?list=open`).then(({ data }) => {
      if (!isMountedRef.current) return;

      const result = {};
      data.forEach((game) => {
        const gameType = game?.setup?.gameType;
        if (!gameType) return;
        if (result[gameType] === undefined) {
          result[gameType] = 0;
        }
        result[gameType]++;

        if (!hasOneOpenGame) setHasOneOpenGame(true);
        if (!hasOneOpenUrankedGame && !game.ranked)
          setHasOneOpenUrankedGame(true);
      });
      setOpenGamesCounts(result);
    });
  }, []);

  const getGameList = async (_listType, _page, finallyCallback = null) => {
    setLoading(true);
    var filterArg = getPageNavFilterArg(_page, page, games, "endTime");

    if (filterArg == null) return;

    filterArg += `&page=${_page}`;
    try {
      const res = await axios.get(
        `/api/game/list?list=${camelCase(
          _listType
        )}&lobby=All&${filterArg}`
      );
      if (!isMountedRef.current) return;

      const filteredGames = (res.data || []).filter(
        (game) => game?.setup?.gameType === selectedGameType
      );

      if (filteredGames.length > 0 || _page === 1) {
        setListType(_listType);
        setPage(_page);
        setGames(filteredGames);
      }
    } catch (err) {
      if (isMountedRef.current) {
        errorAlert();
      }
    }
    if (isMountedRef.current) {
      setLoading(false);
    }
    if (isMountedRef.current && finallyCallback) {
      finallyCallback();
    }
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
    getOpenGameCounts();
  };

  if (!user.loaded) return <Loading small />;
  // Allow logged-out users to access LobbyBrowser

  const gameCategoryPanel = (
    <Paper sx={{ p: 1 }}>
      <Stack spacing={0.5}>
        {gameCatalog.map((game) => (
          <Box
            key={`game-category-${game.key}`}
            component="button"
            onClick={() => setSelectedGameType(game.key)}
            sx={{
              width: "100%",
              border: "1px solid",
              borderColor:
                selectedGameType === game.key ? "primary.main" : "divider",
              borderRadius: 1,
              px: 1,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              backgroundColor:
                selectedGameType === game.key
                  ? "action.selected"
                  : "background.paper",
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <GameIcon gameType={game.key} size={22} circular />
            <Stack
              direction="column"
              sx={{
                minwidth: 0,
                flex: 1,
                textAlign: "left",
              }}
            >
              <Typography variant="body2">
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
                borderRadius: 10,
                px: 0.75,
                py: 0.2,
                backgroundColor: theme.palette.secondary.main,
                color: "white",
                minwidth: "22px",
                textAlign: "center",
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
    <Loading small />
  ) : games.length ? (
    <Stack direction="column" spacing={1}>
      {games.map((game) => {
        return (
          <ListItem disablePadding key={game.id}>
            <Box
              className={game.competitive ? "metallic-gold" : undefined}
              sx={{
                backgroundColor: getRowStubColor(game),
                borderTopLeftRadius: "var(--mui-shape-borderRadius)",
                borderBottomLeftRadius: "var(--mui-shape-borderRadius)",
                alignSelf: "stretch",
                minwidth: "16px",
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
    <Typography style={{ textAlign: "center" }}>
      No open games in this category right now.
    </Typography>
  );

  const buttons = (
    <Paper>
      <Stack
        direction="row"
        sx={{
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <PageNav page={page} onNav={(page) => getGameList(listType, page)} />
        <Typography variant="h3" color="primary">
          Games
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {user.loggedIn && (
            <Button
              variant="outlined"
              size="small"
              href="/play/create"
            >
              Create Host
            </Button>
          )}
          <div onClick={refreshGames}>
            <RefreshButton isSpinning={refreshButtonIsSpinning} />
          </div>
        </Stack>
      </Stack>
    </Paper>
  );

  return (
    <Stack direction="column" spacing={1} sx={{ pt: 4 }}>
      <Grid2 container rowSpacing={2} columnSpacing={2}>
        <Grid2 size={{ xs: 12, md: 2.5 }}>
          <Stack spacing={1}>
            {gameCategoryPanel}
          </Stack>
        </Grid2>
        <Grid2 size={{ xs: 12, md: 5.5 }}>
          <Stack spacing={2}>
            <Stack direction="column" spacing={1}>
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
  );
}
