import React, { useState, useEffect, useContext, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { UserContext } from "Contexts";
import { PageNav, SearchBar } from "components/Nav";
import Setup, { SetupManipulationButtons } from "components/Setup";
import { UserSearchSelect } from "components/Form";
import HostGameDialogue from "components/HostGameDialogue";
import { useErrorAlert } from "components/Alerts";

import "css/buttons.css";
import "css/host.css";
import { clamp } from "../../../lib/MathExt";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  SwipeableDrawer,
  Tab,
  Tabs,
  Typography,
  useTheme,
  Grid,
} from "@mui/material";

import GameIcon from "components/GameIcon";
import { SiteInfoContext } from "Contexts";

export default function HostBrowser(props) {
  const siteInfo = useContext(SiteInfoContext);
  const gameCatalog = siteInfo?.gameCatalog || [];
  const defaultGameType = gameCatalog[0]?.key || "Mafia";
  const defaultNavLabel = "Popular";
  const formFields = props.formFields;

  const [selSetup, setSelSetup] = useState(null);
  const [ishostGameDialogueOpen, setIshostGameDialogueOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [hostNavLabel, setHostNavLabel] = useState(defaultNavLabel);
  const [pageCount, setPageCount] = useState(1);
  const [setups, setSetups] = useState([]);
  const isMountedRef = useRef(true);

  const isPhoneDevice = useIsPhoneDevice();
  const theme = useTheme();
  const errorAlert = useErrorAlert();
  const location = useLocation();
  const navigate = useNavigate();

  const minSlots = 1;
  const maxSlots = 50;

  const params = new URLSearchParams(location.search);
  const preSelectedDeck = new URLSearchParams(location.search).get("deck");

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
            gameType: action.value,
            page: 1,
            option: defaultNavLabel,
            query: "",
          };
        }
        case "ChangeMinSlots": {
          return { ...state, minSlots: action.value };
        }
        case "ChangeMaxSlots": {
          return { ...state, maxSlots: action.value };
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
      }
    },
    {
      page: 1,
      option: defaultNavLabel,
      query: "",
      minSlots: minSlots,
      maxSlots: maxSlots,
      sortBy: "",
      creatorId: "",
      creatorName: "",
    }
  );

  const [gameType, setGameType] = useState(
    params.get("game") || localStorage.getItem("gameType") || defaultGameType
  );

  const handleListItemClick = (newValue) => {
    setGameType(newValue);
    localStorage.setItem("gameType", newValue);
    navigate({
      pathname: location.pathname,
      search: new URLSearchParams({
        game: newValue,
      }).toString(),
    });
    setDrawerOpen(false);
  };

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      getSetupList(filters);
    }, 100);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [filters, gameType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function getSetupList(filters) {
    axios
      .get(
        `/api/setup/search?${new URLSearchParams({
          gameType: gameType,
          ...filters,
        }).toString()}`
      )
      .then((res) => {
        if (isMountedRef.current) {
          setSetups(res.data.setups);
          setPageCount(res.data.pages);
        }
      })
      .catch(() => {
        // Silently handle errors
      });
  }

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
      minSlots,
      Math.min(filters.maxSlots, maxSlots)
    );
    dispatchFilters({ type: "ChangeMinSlots", value });
  }

  function onMaxSlotsChange(e) {
    let value = clamp(
      e.target.value,
      Math.max(filters.minSlots, minSlots),
      maxSlots
    );
    dispatchFilters({ type: "ChangeMaxSlots", value });
  }

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

  function onSelectSetup(setup) {
    setSelSetup(setup);
    setIshostGameDialogueOpen(true);
  }

  function onFavSetup(favSetup) {
    axios.post("/api/setup/favorite", { id: favSetup.id }).catch(errorAlert);

    var newSetups = [...setups];

    for (let i in setups) {
      if (setups[i].id === favSetup.id) {
        newSetups[i].favorite = !setups[i].favorite;
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

  const hostButtonLabels = [
    "Yours",
    "Popular",
    "Favorites",
    "Featured",
    "Ranked",
    "Competitive",
  ];

  const hostNavTabs = (
    <Tabs
      value={hostNavLabel}
      onChange={(_, newValue) => onHostNavClick(newValue)}
    >
      {hostButtonLabels.map((label) => (
        <Tab key={label} label={<div>{label}</div>} value={label} />
      ))}
    </Tabs>
  );

  const setupRows = setups.map((setup) => (
    <SetupRow
      setup={setup}
      listType={filters.option}
      onSelect={onSelectSetup}
      onFav={onFavSetup}
      onEdit={onEditSetup}
      onCopy={onCopySetup}
      onDel={onDelSetup}
      odd={setups.indexOf(setup) % 2 === 1}
      key={setup.id}
    />
  ));

  const renderGameCatalogItem = (game) => (
    <Box
      key={game.key}
      component="button"
      type="button"
      onClick={() => handleListItemClick(game.key)}
      sx={{
        width: "100%",
        border: "1px solid",
        borderColor: gameType === game.key ? "primary.main" : "divider",
        borderRadius: 1,
        px: 1,
        py: 0.75,
        display: "flex",
        alignItems: "center",
        gap: 1,
        cursor: "pointer",
        backgroundColor:
          gameType === game.key ? "action.selected" : "background.paper",
        color: "text.primary",
        font: "inherit",
        "&:hover": {
          backgroundColor: "action.hover",
        },
      }}
    >
      <GameIcon gameType={game.key} size={22} circular />
      <Stack
        direction="column"
        sx={{
          minWidth: 0,
          flex: 1,
          textAlign: "left",
        }}
      >
        <Typography variant="body2">{game.title}</Typography>
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
              width: 240,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: { width: 240, boxSizing: "border-box" },
            }}
          >
            <Stack spacing={0.5} sx={{ p: 1 }}>
              {gameCatalog.map(renderGameCatalogItem)}
            </Stack>
          </SwipeableDrawer>
        </>
      )}
      <Stack
        direction="column"
        className="host"
        sx={{
          alignItems: "center",
        }}
      >
        <Grid container spacing={1} sx={{ my: 1 }}>
          <Grid item xs={6} md={4}>
            <Paper sx={{ height: "100%" }}>
              <div className="range-wrapper-slots">
                <i className="fas fa-filter" />
                Min slots
                <input
                  type="number"
                  min={minSlots}
                  max={Math.min(filters.maxSlots, maxSlots)}
                  step={1}
                  value={filters.minSlots}
                  onChange={onMinSlotsChange}
                />
              </div>
            </Paper>
          </Grid>
          <Grid item xs={6} md={4}>
            <Paper sx={{ height: "100%" }}>
              <div className="range-wrapper-slots">
                Max slots
                <input
                  type="number"
                  min={Math.max(filters.minSlots, minSlots)}
                  max={maxSlots}
                  step={1}
                  value={filters.maxSlots}
                  onChange={onMaxSlotsChange}
                />
              </div>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper>
              <SearchBar
                value={filters.query}
                placeholder="🔎 Setup Name or Role"
                onInput={onSearchInput}
              />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="host-sort-by-label">Sort by</InputLabel>
                <Select
                  labelId="host-sort-by-label"
                  value={filters.sortBy ?? ""}
                  label="Sort by"
                  onChange={(e) =>
                    dispatchFilters({ type: "ChangeSortBy", value: e.target.value })
                  }
                >
                  {sortByOptions.map((opt) => (
                    <MenuItem key={opt.value || "default"} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <UserSearchSelect
                  value={filters.creatorName ?? ""}
                  onChange={onCreatorSelect}
                  placeholder="Filter by creator"
                />
              </FormControl>
            </Stack>
          </Grid>
        </Grid>
        <Box
          sx={{
            alignSelf: "normal",
          }}
        >
          {hostNavTabs}
        </Box>
        <Box
          sx={{
            alignSelf: "stretch",
          }}
        >
          <Divider sx={{ mb: 1 }} />
          <Stack
            direction="row"
            sx={{
              alignItems: "stretch",
            }}
          >
            {!isPhoneDevice && (
              <Paper
                sx={{
                  flex: "0 0 20%",
                  mr: 1,
                  p: 0.5,
                }}
              >
                <Stack direction="column" spacing={0.5}>
                  {gameCatalog.map(renderGameCatalogItem)}
                </Stack>
              </Paper>
            )}
            <Paper
              sx={{
                minWidth: 0,
                flex: "1 1",
              }}
            >
              <Stack
                direction="column"
                divider={<Divider orientation="horizontal" flexItem />}
              >
                {setupRows}
              </Stack>
            </Paper>
          </Stack>
        </Box>
        <Paper
          sx={{
            p: 1,
            mt: 1,
            mb: 1,
          }}
        >
          <PageNav page={filters.page} maxPage={pageCount} onNav={onPageNav} />
        </Paper>
        {selSetup && (
          <HostGameDialogue
            open={ishostGameDialogueOpen}
            setOpen={setIshostGameDialogueOpen}
            setup={selSetup}
            preSelectedDeck={preSelectedDeck}
          />
        )}
      </Stack>
    </>
  );
}

function SetupRow(props) {
  const user = useContext(UserContext);
  const isPhoneDevice = useIsPhoneDevice();

  const favIconFormat = props.setup.favorite ? "fas" : "far";

  return (
    <Stack
      direction={isPhoneDevice ? "column-reverse" : "row"}
      spacing={1}
      className="setup-row"
      sx={{
        p: 1,
        alignItems: "center",
        justifyContent: "start",
        width: "100%",
      }}
    >
      {!isPhoneDevice && user.loggedIn && (
        <Button onClick={() => props.onSelect(props.setup)}>Host</Button>
      )}
      <Box
        sx={{
          minWidth: 0,
          width: "100%",
          flex: "1 1",
        }}
      >
        <Setup setup={props.setup} />
      </Box>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          alignSelf: "stretch",
          ml: isPhoneDevice ? undefined : "auto !important",
        }}
      >
        {isPhoneDevice && user.loggedIn && (
          <Button onClick={() => props.onSelect(props.setup)}>Host</Button>
        )}
        {user.loggedIn && (
          <Box sx={{ ml: "auto" }}>
            <SetupManipulationButtons
              setup={props.setup}
              onFav={props.onFav}
              onEdit={props.onEdit}
              onCopy={props.onCopy}
              onDel={props.onDel}
            />
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
