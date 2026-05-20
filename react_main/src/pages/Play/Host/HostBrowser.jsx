import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useContext,
  useReducer,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { SiteInfoContext, UserContext } from "Contexts";
import { PageNav } from "components/Nav";
import Setup, { SetupManipulationButtons } from "components/Setup";
import { UserSearchSelect } from "components/Form";
import HostGameDialogue from "components/HostGameDialogue";
import { useErrorAlert } from "components/Alerts";
import { Loading } from "components/Loading";

import "css/buttons.css";
import "css/host.css";
import { clamp } from "../../../lib/MathExt";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItem,
  MenuItem,
  Paper,
  Select,
  Stack,
  SwipeableDrawer,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
  Grid2,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import GameIcon from "components/GameIcon";

const MIN_SLOTS = 1;
const MAX_SLOTS = 50;
const DEFAULT_NAV_LABEL = "Popular";

export default function HostBrowser() {
  const siteInfo = useContext(SiteInfoContext);
  const user = useContext(UserContext);
  const gameCatalog = useMemo(
    () => siteInfo?.gameCatalog || [],
    [siteInfo?.gameCatalog]
  );
  const defaultGameType = gameCatalog[0]?.key || "Mafia";

  const [selSetup, setSelSetup] = useState(null);
  const [ishostGameDialogueOpen, setIshostGameDialogueOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hostNavLabel, setHostNavLabel] = useState(DEFAULT_NAV_LABEL);
  const [pageCount, setPageCount] = useState(1);
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  const isPhoneDevice = useIsPhoneDevice();
  const theme = useTheme();
  const errorAlert = useErrorAlert();
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const preSelectedDeck = params.get("deck");
  const requestedSetupId = params.get("setup");

  const [filters, dispatchFilters] = useReducer(
    (state, action) => {
      switch (action.type) {
        case "ChangeList": {
          return {
            ...state,
            option: action.value,
            page: 1,
            query: "",
            ...(action.value === "Yours"
              ? { creatorId: "", creatorName: "" }
              : {}),
          };
        }
        case "ChangePage": {
          return { ...state, page: action.value };
        }
        case "ChangeQuery": {
          return { ...state, page: 1, query: action.value };
        }
        case "ChangeGame": {
          return {
            ...state,
            page: 1,
            option: DEFAULT_NAV_LABEL,
            query: "",
            creatorId: "",
            creatorName: "",
          };
        }
        case "ChangeMinSlots": {
          return { ...state, page: 1, minSlots: action.value };
        }
        case "ChangeMaxSlots": {
          return { ...state, page: 1, maxSlots: action.value };
        }
        case "ChangeSortBy": {
          return { ...state, page: 1, sortBy: action.value };
        }
        case "ChangeCreator": {
          return {
            ...state,
            page: 1,
            creatorId: action.value?.id ?? "",
            creatorName: action.value?.name ?? "",
          };
        }
        default:
          return state;
      }
    },
    {
      page: 1,
      option: DEFAULT_NAV_LABEL,
      query: "",
      minSlots: MIN_SLOTS,
      maxSlots: MAX_SLOTS,
      sortBy: "",
      creatorId: "",
      creatorName: "",
    }
  );

  const [gameType, setGameType] = useState(
    params.get("game") || localStorage.getItem("gameType") || defaultGameType
  );

  const selectedGameMeta =
    gameCatalog.find((game) => game.key === gameType) ||
    gameCatalog[0] ||
    {};

  const sortByOptions = [
    { value: "", label: "Default" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "updated", label: "Most recently updated" },
    { value: "upvoted", label: "Most upvoted" },
    { value: "downvoted", label: "Most downvoted" },
    { value: "controversial", label: "Most controversial" },
    { value: "favorites", label: "Most favorites" },
    { value: "played", label: "Most played" },
  ];

  const hostButtonLabels = user.loggedIn
    ? ["Yours", "Popular", "Favorites", "Featured", "Ranked", "Competitive"]
    : ["Popular", "Featured", "Ranked", "Competitive"];

  const panelSx = {
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    background:
      theme.palette.mode === "dark"
        ? "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))"
        : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.74))",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 18px 48px rgba(0, 0, 0, 0.24)"
        : "0 18px 48px rgba(33, 43, 54, 0.12)",
    overflow: "hidden",
  };

  const getSetupList = useCallback(
    (activeFilters) => {
      setLoading(true);
      axios
        .get(
          `/api/setup/search?${new URLSearchParams({
            gameType: gameType,
            ...activeFilters,
          }).toString()}`
        )
        .then((res) => {
          if (!isMountedRef.current) return;
          setSetups(res.data.setups || []);
          setPageCount(res.data.pages || 1);
        })
        .catch(() => {
          if (isMountedRef.current) {
            setSetups([]);
            setPageCount(1);
          }
        })
        .finally(() => {
          if (isMountedRef.current) {
            setLoading(false);
          }
        });
    },
    [gameType]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!gameCatalog.length) return;

    const gameKeys = gameCatalog.map((game) => game.key);
    if (gameKeys.includes(gameType)) return;

    setGameType(defaultGameType);
    localStorage.setItem("gameType", defaultGameType);
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("game", defaultGameType);
    navigate(
      { pathname: location.pathname, search: nextParams.toString() },
      { replace: true }
    );
  }, [defaultGameType, gameCatalog, gameType, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!user.loggedIn && ["Yours", "Favorites"].includes(hostNavLabel)) {
      setHostNavLabel(DEFAULT_NAV_LABEL);
      dispatchFilters({ type: "ChangeList", value: DEFAULT_NAV_LABEL });
    }
  }, [hostNavLabel, user.loggedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      getSetupList(filters);
    }, 100);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [filters, getSetupList]);

  useEffect(() => {
    if (!requestedSetupId) return;

    let active = true;
    axios
      .get(
        `/api/setup/id?${new URLSearchParams({
          query: requestedSetupId,
        }).toString()}`
      )
      .then((res) => {
        if (!active || !isMountedRef.current) return;
        const setup = res.data?.setups?.[0];
        if (!setup) return;

        setSelSetup(setup);
        setIshostGameDialogueOpen(true);

        if (setup.gameType && setup.gameType !== gameType) {
          setGameType(setup.gameType);
          localStorage.setItem("gameType", setup.gameType);
          const nextParams = new URLSearchParams(location.search);
          nextParams.set("game", setup.gameType);
          navigate(
            { pathname: location.pathname, search: nextParams.toString() },
            { replace: true }
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [gameType, location.pathname, location.search, navigate, requestedSetupId]);

  function handleListItemClick(newValue) {
    setGameType(newValue);
    setHostNavLabel(DEFAULT_NAV_LABEL);
    dispatchFilters({ type: "ChangeGame" });
    localStorage.setItem("gameType", newValue);

    const nextParams = new URLSearchParams(location.search);
    nextParams.set("game", newValue);
    nextParams.delete("setup");
    navigate({
      pathname: location.pathname,
      search: nextParams.toString(),
    });
    setDrawerOpen(false);
  }

  const toggleDrawer = (open) => (event) => {
    if (
      event &&
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  function onHostNavClick(listType) {
    dispatchFilters({ type: "ChangeList", value: listType });
    setHostNavLabel(listType);
  }

  function onSearchInput(query) {
    dispatchFilters({ type: "ChangeQuery", value: query });
  }

  function onCreatorSelect(userId, userName) {
    dispatchFilters({
      type: "ChangeCreator",
      value:
        userId != null && userId !== ""
          ? { id: userId, name: userName ?? "" }
          : null,
    });
  }

  function onPageNav(page) {
    dispatchFilters({ type: "ChangePage", value: page });
  }

  function onMinSlotsChange(e) {
    let value = clamp(
      e.target.value,
      MIN_SLOTS,
      Math.min(filters.maxSlots, MAX_SLOTS)
    );
    dispatchFilters({ type: "ChangeMinSlots", value });
  }

  function onMaxSlotsChange(e) {
    let value = clamp(
      e.target.value,
      Math.max(filters.minSlots, MIN_SLOTS),
      MAX_SLOTS
    );
    dispatchFilters({ type: "ChangeMaxSlots", value });
  }

  function onSelectSetup(setup) {
    setSelSetup(setup);
    setIshostGameDialogueOpen(true);
  }

  function onFavSetup(favSetup) {
    axios.post("/api/setup/favorite", { id: favSetup.id }).catch(errorAlert);

    const newSetups = [...setups];
    for (let i in setups) {
      if (setups[i].id === favSetup.id) {
        newSetups[i] = {
          ...setups[i],
          favorite: !setups[i].favorite,
        };
        break;
      }
    }

    setSetups(newSetups);
  }

  function onEditSetup(setup) {
    navigate(`/play/create?edit=${setup.id}&game=${setup.gameType}`);
  }

  function onCopySetup(setup) {
    navigate(`/play/create?copy=${setup.id}&game=${setup.gameType}`);
  }

  function onDelSetup(setup) {
    axios
      .post("/api/setup/delete", { id: setup.id })
      .then(() => {
        getSetupList(filters);
      })
      .catch(errorAlert);
  }

  const renderGameCatalogItem = (game) => (
    <Box
      key={game.key}
      component="button"
      type="button"
      onClick={() => handleListItemClick(game.key)}
      className="host-game-option"
      sx={{
        width: "100%",
        border: 1,
        borderColor: gameType === game.key ? "primary.main" : "divider",
        borderRadius: 1,
        px: 1.25,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        cursor: "pointer",
        backgroundColor:
          gameType === game.key
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
              mt: "5px",
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
    </Box>
  );

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
        <SportsEsportsRoundedIcon color="secondary" />
      </Stack>
      <Divider sx={{ mb: 1 }} />
      <Stack spacing={0.75}>{gameCatalog.map(renderGameCatalogItem)}</Stack>
    </Paper>
  );

  const setupRows = setups.map((setup, index) => (
    <SetupRow
      setup={setup}
      onSelect={onSelectSetup}
      onFav={onFavSetup}
      onEdit={onEditSetup}
      onCopy={onCopySetup}
      onDel={onDelSetup}
      key={setup.id}
      odd={index % 2 === 1}
    />
  ));

  const setupList = loading ? (
    <Paper sx={{ ...panelSx, py: 6 }}>
      <Loading small />
    </Paper>
  ) : setupRows.length ? (
    <Stack direction="column" spacing={1.25}>
      {setupRows}
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
      <FilterListRoundedIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
      <Typography variant="h3" color="primary">
        No setups found
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        {selectedGameMeta.title || gameType}
      </Typography>
    </Paper>
  );

  if (!user.loaded) return <Loading small />;

  return (
    <>
      {isPhoneDevice && (
        <>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer(true)}
            sx={{
              position: "fixed",
              top: "50%",
              left: 0,
              zIndex: 1201,
              visibility: drawerOpen ? "hidden" : "visible",
              backgroundColor: theme.palette.secondary.main,
              width: 46,
              height: 46,
              padding: 0,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            <GameIcon gameType={gameType} size={46} circular />
          </IconButton>
          <Paper
            onClick={toggleDrawer(true)}
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100%",
              width: "10px",
              backgroundColor: "transparent",
              zIndex: 1200,
              cursor: "pointer",
            }}
          />
          <SwipeableDrawer
            anchor="left"
            open={drawerOpen}
            onClose={toggleDrawer(false)}
            onOpen={toggleDrawer(true)}
            sx={{
              width: 260,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: { width: 260, boxSizing: "border-box" },
            }}
          >
            <Stack spacing={0.75} sx={{ p: 1 }}>
              {gameCatalog.map(renderGameCatalogItem)}
            </Stack>
          </SwipeableDrawer>
        </>
      )}
      <Box
        className="host"
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
                <GameIcon gameType={gameType} size={58} circular />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h2" noWrap>
                    Host {selectedGameMeta.title || gameType}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}
                  >
                    <Chip
                      size="small"
                      icon={<TuneRoundedIcon />}
                      label={hostNavLabel}
                      color="primary"
                      sx={{ borderRadius: 1, fontWeight: 800 }}
                    />
                    <Chip
                      size="small"
                      icon={<GroupsRoundedIcon />}
                      label={`${filters.minSlots}-${filters.maxSlots} slots`}
                      color="secondary"
                      sx={{ borderRadius: 1, fontWeight: 800 }}
                    />
                    {Number(selectedGameMeta.coins || 0) > 0 && (
                      <Chip
                        size="small"
                        icon={<i className="fas fa-coins" />}
                        label={`${Number(selectedGameMeta.coins).toLocaleString()} coins`}
                        color="warning"
                        sx={{ borderRadius: 1, fontWeight: 800 }}
                      />
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  justifyContent: { xs: "flex-start", md: "flex-end" },
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Chip
                  icon={<SportsEsportsRoundedIcon />}
                  label={`${setups.length} shown`}
                  sx={{ borderRadius: 1, fontWeight: 800 }}
                />
                {user.loggedIn && (
                  <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() =>
                      navigate(
                        `/play/create?game=${encodeURIComponent(gameType)}`
                      )
                    }
                  >
                    Create Setup
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>

          <Grid2 container rowSpacing={2} columnSpacing={2}>
            {!isPhoneDevice && (
              <Grid2 size={{ xs: 12, md: 2.7 }}>{gameCategoryPanel}</Grid2>
            )}
            <Grid2 size={{ xs: 12, md: isPhoneDevice ? 12 : 9.3 }}>
              <Stack spacing={2}>
                <Paper sx={{ ...panelSx, p: { xs: 1.25, md: 1.5 } }}>
                  <Stack spacing={1.5}>
                    <Tabs
                      value={hostNavLabel}
                      onChange={(_, newValue) => onHostNavClick(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                    >
                      {hostButtonLabels.map((label) => (
                        <Tab key={label} label={label} value={label} />
                      ))}
                    </Tabs>
                    <Divider />
                    <Grid2 container spacing={1.25}>
                      <Grid2 size={{ xs: 12, md: 4 }}>
                        <TextField
                          value={filters.query}
                          placeholder="Setup name or role"
                          onChange={(e) => onSearchInput(e.target.value)}
                          size="small"
                          fullWidth
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid2>
                      <Grid2 size={{ xs: 6, md: 1.5 }}>
                        <TextField
                          type="number"
                          label="Min slots"
                          size="small"
                          fullWidth
                          value={filters.minSlots}
                          inputProps={{
                            min: MIN_SLOTS,
                            max: Math.min(filters.maxSlots, MAX_SLOTS),
                            step: 1,
                          }}
                          onChange={onMinSlotsChange}
                        />
                      </Grid2>
                      <Grid2 size={{ xs: 6, md: 1.5 }}>
                        <TextField
                          type="number"
                          label="Max slots"
                          size="small"
                          fullWidth
                          value={filters.maxSlots}
                          inputProps={{
                            min: Math.max(filters.minSlots, MIN_SLOTS),
                            max: MAX_SLOTS,
                            step: 1,
                          }}
                          onChange={onMaxSlotsChange}
                        />
                      </Grid2>
                      <Grid2 size={{ xs: 12, md: 2.5 }}>
                        <FormControl size="small" fullWidth>
                          <InputLabel id="host-sort-by-label">
                            Sort by
                          </InputLabel>
                          <Select
                            labelId="host-sort-by-label"
                            value={filters.sortBy ?? ""}
                            label="Sort by"
                            onChange={(e) =>
                              dispatchFilters({
                                type: "ChangeSortBy",
                                value: e.target.value,
                              })
                            }
                            startAdornment={
                              <InputAdornment position="start">
                                <SortRoundedIcon fontSize="small" />
                              </InputAdornment>
                            }
                          >
                            {sortByOptions.map((opt) => (
                              <MenuItem
                                key={opt.value || "default"}
                                value={opt.value}
                              >
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid2>
                      <Grid2 size={{ xs: 12, md: 2.5 }}>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr)",
                            alignItems: "center",
                            gap: 0.75,
                          }}
                        >
                          <PersonSearchRoundedIcon color="action" />
                          <UserSearchSelect
                            value={filters.creatorName ?? ""}
                            onChange={onCreatorSelect}
                            placeholder="Creator"
                          />
                        </Box>
                      </Grid2>
                    </Grid2>
                  </Stack>
                </Paper>

                <Stack spacing={1.25}>
                  <Paper sx={{ ...panelSx, p: 1.25 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.25}
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", minWidth: 0 }}
                      >
                        <FilterListRoundedIcon color="primary" />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h3" color="primary" noWrap>
                            Setups
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Page {filters.page} of {pageCount}
                          </Typography>
                        </Box>
                      </Stack>
                      <PageNav
                        page={filters.page}
                        maxPage={pageCount}
                        onNav={onPageNav}
                      />
                    </Stack>
                  </Paper>
                  {setupList}
                </Stack>
              </Stack>
            </Grid2>
          </Grid2>
        </Stack>
        {selSetup && (
          <HostGameDialogue
            open={ishostGameDialogueOpen}
            setOpen={setIshostGameDialogueOpen}
            setup={selSetup}
            preSelectedDeck={preSelectedDeck}
          />
        )}
      </Box>
    </>
  );
}

function SetupRow(props) {
  const user = useContext(UserContext);
  const isPhoneDevice = useIsPhoneDevice();
  const theme = useTheme();

  const setupType = props.setup.closed
    ? props.setup.useRoleGroups
      ? "Closed groups"
      : "Closed"
    : "Open";

  return (
    <ListItem
      disablePadding
      className="host-setup-row"
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
        sx={{
          alignSelf: "stretch",
          minWidth: "8px",
          background:
            props.odd
              ? "rgba(var(--mui-palette-secondary-mainChannel) / 0.65)"
              : "rgba(var(--mui-palette-primary-mainChannel) / 0.72)",
        }}
      />
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        sx={{
          p: 1,
          width: "100%",
          minWidth: 0,
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        {user.loggedIn && (
          <Button
            variant="contained"
            startIcon={<CasinoRoundedIcon />}
            onClick={() => props.onSelect(props.setup)}
            sx={{
              flex: { xs: "1 1 auto", md: "0 0 auto" },
              minWidth: { xs: "100%", md: 96 },
            }}
          >
            Host
          </Button>
        )}
        <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
          <Setup setup={props.setup} />
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              mt: 0.75,
              flexWrap: "wrap",
              gap: 0.75,
            }}
          >
            <Chip
              size="small"
              icon={<GroupsRoundedIcon />}
              label={`${props.setup.total || "?"} slots`}
              sx={{ borderRadius: 1, fontWeight: 700 }}
            />
            <Chip
              size="small"
              label={setupType}
              sx={{ borderRadius: 1, fontWeight: 700 }}
            />
            {props.setup.featured && (
              <Chip
                size="small"
                color="secondary"
                icon={<StarRoundedIcon />}
                label="Featured"
                sx={{ borderRadius: 1, fontWeight: 800 }}
              />
            )}
            {props.setup.ranked && (
              <Chip
                size="small"
                color="primary"
                label="Ranked"
                sx={{ borderRadius: 1, fontWeight: 800 }}
              />
            )}
            {props.setup.competitive && (
              <Chip
                size="small"
                color="warning"
                label="Competitive"
                sx={{ borderRadius: 1, fontWeight: 800 }}
              />
            )}
            {Number.isFinite(Number(props.setup.played)) && (
              <Chip
                size="small"
                label={`${Number(props.setup.played).toLocaleString()} plays`}
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            )}
            {Number.isFinite(Number(props.setup.favorites)) && (
              <Chip
                size="small"
                label={`${Number(props.setup.favorites).toLocaleString()} favs`}
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            )}
            {Number.isFinite(Number(props.setup.voteCount)) && (
              <Chip
                size="small"
                label={`${Number(props.setup.voteCount).toLocaleString()} votes`}
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            )}
            {props.setup.creator?.name && (
              <Chip
                size="small"
                label={props.setup.creator.name}
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            )}
          </Stack>
        </Box>
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: isPhoneDevice ? "flex-end" : "center",
            flex: { xs: "1 1 auto", md: "0 0 auto" },
          }}
        >
          {user.loggedIn && (
            <SetupManipulationButtons
              setup={props.setup}
              onFav={props.onFav}
              onEdit={props.onEdit}
              onCopy={props.onCopy}
              onDel={props.onDel}
            />
          )}
        </Stack>
      </Stack>
    </ListItem>
  );
}
