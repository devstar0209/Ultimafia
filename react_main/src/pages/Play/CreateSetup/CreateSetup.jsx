import React, { useState, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SwipeableDrawer,
  List,
  ListItemText,
  ListItemIcon,
  IconButton,
  Box,
  Paper,
  useTheme,
  ListItemButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import CreateMafiaSetup from "./CreateMafiaSetup";
import CreateResistanceSetup from "./CreateResistanceSetup";
import CreateJottoSetup from "./CreateJottoSetup";
import CreateAcrotopiaSetup from "./CreateAcrotopiaSetup";
import CreateSecretDictatorSetup from "./CreateSecretDictatorSetup";
import CreateWackyWordsSetup from "./CreateWackyWordsSetup";
import CreateLiarsDiceSetup from "./CreateLiarsDiceSetup";
import CreateTexasHoldEmSetup from "./CreateTexasHoldEmSetup";
import CreateCheatSetup from "./CreateCheatSetup";
import CreateRatscrewSetup from "./CreateRatscrewSetup";
import CreateBattlesnakesSetup from "./CreateBattlesnakesSetup";
import CreateDiceWarsSetup from "./CreateDiceWarsSetup";
import CreateConnectFourSetup from "./CreateConnectFourSetup";

import { SiteInfoContext } from "Contexts";
import GameIcon from "components/GameIcon";

const DEFAULT_GAME_SETUP_HELP = {
  summary: "Configure your setup, then host when your room settings look good.",
  tips: [
    "Start from a familiar setup if this is your first game.",
    "Double-check player count before hosting.",
    "Use timers and modifiers to match your lobby style.",
  ],
};

const GAME_SETUP_HELP = {
  Mafia: {
    summary: "🎮 A hidden-role social deduction game with day and night phases.",
    tips: [
      "👥 Minimum players: 3 (2 🟢 Village, 1 🔴 Mafia or equivalent)",
      "👍 Recommended players: 3-6 for better balance",
      "🎯 Keep village and mafia power levels close.",
      "🌞 Set day and night timers based on lobby pace.",
      "⚡ Choose Fast Mode for 3-5 minute matches",
      "🕰️ Choose Classic Mode for longer gameplay"
    ],
  },
  Resistance: {
    summary: "Team-based bluffing where players approve missions and hunt spies.",
    tips: [
      "Smaller lobbies make vote reads more meaningful.",
      "Tune mission failure count for difficulty.",
      "Avoid too many swing roles for beginner groups.",
    ],
  },
  Jotto: {
    summary: "Word-guessing deduction where players narrow answers with clues.",
    tips: [
      "Use clear round timers to keep momentum.",
      "Set language expectations before start.",
      "Prefer medium-length words for fair difficulty.",
    ],
  },
  Acrotopia: {
    summary: "A creative acronym game where players bluff and vote on meanings.",
    tips: [
      "Short timers keep rounds fun and snappy.",
      "Encourage players to avoid inside-joke answers.",
      "Keep lobby size moderate for faster reveals.",
    ],
  },
  "Secret Dictator": {
    summary: "Hidden teams compete through elections, laws, and special powers.",
    tips: [
      "Use role counts suited to your player size.",
      "Longer discussion timers improve deduction quality.",
      "Clarify policy win conditions before game start.",
    ],
  },
  "Wacky Words": {
    summary: "Party-style word game focused on fast thinking and creativity.",
    tips: [
      "Use short rounds for high energy.",
      "Balance score targets with expected game length.",
      "Choose settings that reward both speed and accuracy.",
    ],
  },
  "Liars Dice": {
    summary: "Bluffing dice game where players bid, challenge, and outlast rivals.",
    tips: [
      "Keep reveal pace quick to maintain tension.",
      "Tune starting resources for game length.",
      "Good for small-to-medium lobby sizes.",
    ],
  },
  "Texas Hold Em": {
    summary: "Classic poker setup with betting rounds and showdown play.",
    tips: [
      "Set blinds and starting chips for desired duration.",
      "Use clear turn timers to prevent stalling.",
      "Confirm house rules with players before hosting.",
    ],
  },
  Cheat: {
    summary: "Card shedding game centered on deception and callouts.",
    tips: [
      "Fast turn timers keep bluff windows exciting.",
      "Choose deck/rule variants before launch.",
      "Great for casual, medium-sized groups.",
    ],
  },
  Ratscrew: {
    summary: "Reflex-heavy card game where slaps and quick reads matter.",
    tips: [
      "Prefer low latency settings and shorter rounds.",
      "Explain slap conditions before starting.",
      "Best with players ready for fast action.",
    ],
  },
  Battlesnakes: {
    summary: "Competitive survival-style snake matches in shared arenas.",
    tips: [
      "Tune map/round settings for lobby skill level.",
      "Shorter rounds reduce waiting after knockouts.",
      "Use balanced start conditions for fair matches.",
    ],
  },
  "Connect Four": {
    summary: "Head-to-head strategy game about alignment and board control.",
    tips: [
      "Use quick timers for a brisk duel format.",
      "Ideal for small lobbies and tournament rotations.",
      "Keep rematch flow easy for repeated rounds.",
    ],
  },
  "Dice Wars": {
    summary: "Territory control game where dice battles decide expansion.",
    tips: [
      "Map size should match player count.",
      "Longer timers help planning-heavy games.",
      "Balance starting positions for fairness.",
    ],
  },
};

export default function CreateSetup(props) {
  const theme = useTheme();
  const siteInfo = useContext(SiteInfoContext);
  const gameCatalog = siteInfo?.gameCatalog || [];
  const defaultGameType = gameCatalog[0]?.key || "Mafia";
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [gameType, setGameType] = useState(
    params.get("game") || localStorage.getItem("gameType") || defaultGameType
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const navigate = useNavigate();
  const gameHelp = GAME_SETUP_HELP[gameType] || DEFAULT_GAME_SETUP_HELP;

  useEffect(() => {
    const gameParam = new URLSearchParams(location.search).get("game");
    if (gameParam && gameParam !== gameType) {
      setGameType(gameParam);
      localStorage.setItem("gameType", gameParam);
    }
  }, [location.search, gameType]);

  const handleListItemClick = (newValue) => {
    setGameType(newValue);
    localStorage.setItem("gameType", newValue);
    const params = new URLSearchParams(location.search);
    params.set("game", newValue);
    navigate({ pathname: location.pathname, search: params.toString() });
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

  function CreatePage() {
    switch (gameType) {
      case "Mafia":
        return <CreateMafiaSetup />;
      case "Resistance":
        return <CreateResistanceSetup />;
      case "Jotto":
        return <CreateJottoSetup />;
      case "Acrotopia":
        return <CreateAcrotopiaSetup />;
      case "Secret Dictator":
        return <CreateSecretDictatorSetup />;
      case "Wacky Words":
        return <CreateWackyWordsSetup />;
      case "Liars Dice":
        return <CreateLiarsDiceSetup />;
      case "Texas Hold Em":
        return <CreateTexasHoldEmSetup />;
      case "Cheat":
        return <CreateCheatSetup />;
      case "Ratscrew":
        return <CreateRatscrewSetup />;
      case "Battlesnakes":
        return <CreateBattlesnakesSetup />;
      case "Dice Wars":
        return <CreateDiceWarsSetup />;
      case "Connect Four":
        return <CreateConnectFourSetup />;
      default:
        setGameType(defaultGameType);
        return null;
    }
  }

  return (
    <>
      <IconButton
        edge="start"
        color="inherit"
        aria-label="menu"
        onClick={toggleDrawer(true)}
        sx={{
          position: "fixed",
          top: "50%",
          left: 30,
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
      <Tooltip title={`Setup help: ${gameType}`} placement="right">
        <IconButton
          color="inherit"
          aria-label="setup-help"
          onClick={() => setHelpDialogOpen(true)}
          sx={{
            position: "fixed",
            top: "calc(50% + 55px)",
            left: 20,
            zIndex: 1201,
            backgroundColor: theme.palette.secondary.main,
            padding: "8px",
            borderRadius: "50%",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          <InfoOutlinedIcon fontSize="medium" />
        </IconButton>
      </Tooltip>
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
        <List>
          {gameCatalog.map((game) => (
            <ListItemButton
              key={game.key}
              selected={gameType === game.key}
              onClick={() => handleListItemClick(game.key)}
            >
              <ListItemIcon>
                <GameIcon gameType={game.key} size={24} />
              </ListItemIcon>
              <ListItemText primary={game.title} />
            </ListItemButton>
          ))}
        </List>
      </SwipeableDrawer>
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GameIcon gameType={gameType} size={24} />
          {gameType} Setup Help
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {gameHelp.summary}
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Quick setup tips
          </Typography>
          <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3 }}>
            {gameHelp.tips.map((tip, index) => (
              <Typography component="li" variant="body2" key={`${gameType}-${index}`} sx={{ mb: 0.75 }}>
                {tip}
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Box>{CreatePage()}</Box>
    </>
  );
}
