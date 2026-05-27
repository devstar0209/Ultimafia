import React, { useContext, useState } from "react";
import axios from "axios";

import "css/shiny.css";
import { Link } from "react-router-dom";
import { PlayerCount } from "./PlayerCount";
import { UserContext, SiteInfoContext } from "Contexts";
import { filterProfanity } from "components/Basic";
import { useErrorAlert } from "components/Alerts";
import Setup from "components/Setup";
import HostGameDialogue from "components/HostGameDialogue";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import { getRowColor, getSetupBackgroundColor } from "./gameRowColors.js";
import StateIcon from "components/StateIcon";
import ConfirmDialog from "components/ConfirmDialog";

const GameStatus = (props) => {
  const user = useContext(UserContext);
  const showGameState = props.showGameState;

  const canShowGameButton =
    (user.loggedIn || props.game.status === "Finished") &&
    !props.game.broken &&
    !props.game.private;

  let buttonUrl, buttonText, buttonVariant, buttonColor, buttonDisabled;
  if (props.game.status === "Open") {
    buttonUrl = `/game/${props.game.id}`;
    buttonText = "Join";
    buttonColor = "primary";
    buttonVariant = "contained";
    buttonDisabled = false;
  } else if (props.game.status === "In Progress") {
    if (props.game.spectating /* || user.perms.canSpectateAny */) {
      buttonUrl = `/game/${props.game.id}?spectate=true`;
      buttonText = "Spectate";
      buttonColor = "inherit";
      buttonVariant = "contained";
      buttonDisabled = false;
    } else {
      buttonUrl = "/play";
      buttonText = "Ongoing";
      buttonColor = "inherit"; //"rgba(211, 211, 211, 0.15)";
      buttonVariant = "contained";
      buttonDisabled = true;
    }
  } else if (props.game.status === "Finished") {
    buttonUrl = `/game/${props.game.id}`;
    buttonText = "Review";
    buttonColor = "inherit"; //"rgba(211, 211, 211, 0.15)";
    buttonVariant = "outlined";
    buttonDisabled = false;
  }

  const GameButton = (
    <Button
      component={Link}
      to={buttonUrl}
      variant={buttonVariant}
      color={buttonColor}
      disabled={buttonDisabled}
      sx={{
        minHeight: 34,
        p: 0.5,
        width: "100%",
        borderRadius: 1,
        fontWeight: "bold",
      }}
    >
      {buttonText}
    </Button>
  );

  const gameButtonWrapped = (
    <Box sx={{ width: 104 }}>
      {canShowGameButton && GameButton}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        {props.game.broken && (
          <i
            className="fas fa-car-crash"
            style={{ fontSize: "24px", cursor: "not-allowed" }}
            title="Broken"
          />
        )}
        {props.game.private && (
          <i
            className="fas fa-lock"
            style={{ fontSize: "24px", cursor: "not-allowed" }}
            title="Private"
          />
        )}
      </div>
    </Box>
  );

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {/* LOBBY ICON GOES HERE */}
      {/* <Box sx={{
        height: "60px",
        width: "60px",
      }}>
      </Box> */}
      {showGameState && (
        <StateIcon
          stateName={props.game.gameState || "Postgame"}
          winnerGroups={props.game.winnersInfo?.groups || []}
        />
      )}
      <Stack
        direction="column"
        spacing={1}
        sx={{
          alignItems: "stretch",
          justifyContent: "center",
          alignSelf: "stretch",
        }}
      >
        <PlayerCount
          game={props.game}
          gameId={props.game.id}
          anonymousGame={props.game.anonymousGame}
          status={props.game.status}
          numSlotsTaken={props.game.players}
          spectatingAllowed={props.game.spectating}
          spectatorCount={props.game.spectatorCount}
        />
        {gameButtonWrapped}
      </Stack>
    </Stack>
  );
};

export const GameRow = (props) => {
  const isPhoneDevice = useIsPhoneDevice();
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const [ishostGameDialogueOpen, setIshostGameDialogueOpen] = useState(false);
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);

  const showLobbyName = props.showLobbyName;
  const canBreakGame = user.perms?.breakGame && !props.game.broken;

  function onBreakGameClick() {
    if (!canBreakGame) return;
    setBreakConfirmOpen(true);
  }

  function breakGame() {
    setBreakConfirmOpen(false);
    axios
      .post("/api/mod/breakGame", { gameId: props.game.id })
      .then(() => {
        siteInfo.showAlert("Game broken.", "success");
      })
      .catch(errorAlert);
  }
  const showGameState = props.showGameState;
  const showGameTypeIcon = props.showGameTypeIcon;
  const showRedoButton = isPhoneDevice
    ? !props.small && props.game.status === "Finished" && user.loggedIn
    : !props.small;
  const lobbyName = props.game.lobbyName;

  if (!props.game.setup) return <></>;

  return (
    <>
    <div className="shiny-container" style={{ minWidth: "0px", width: "100%" }}>
      {props.game.competitive && <i className="shiny" />}
      <HostGameDialogue
        open={ishostGameDialogueOpen}
        setOpen={setIshostGameDialogueOpen}
        setup={props.game.setup}
      />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        sx={{
          p: 1.25,
          width: "100%",
          alignItems: { xs: "stretch", sm: "center" },
          background: `linear-gradient(90deg, ${getRowColor(
            props.game,
            false
          )}, rgba(255, 255, 255, 0.02))`,
          transition: "background 160ms ease",
          "&:hover": {
            background: getRowColor(props.game, true),
          },
        }}
        key={props.game.id}
      >
        <GameStatus
          small={props?.small}
          game={props.game}
          status={props.game.status}
          showGameTypeIcon={showGameTypeIcon}
          showGameState={showGameState}
        />
        <Stack
          direction="column"
          sx={{
            minWidth: 0,
            flex: "1 1",
          }}
        >
          {showLobbyName && (
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
              }}
            >
              {/* game option indicators go HERE */}
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: "center",
                }}
              >
                {props.game.anonymousGame && (
                  <Tooltip title="Anonymous game">
                    <i
                      className="fas fa-theater-masks"
                      style={{
                        fontSize: "1rem",
                      }}
                    />
                  </Tooltip>
                )}
                {Number(props.game.coinsRequired || 0) > 0 && (
                  <Tooltip title="Coins required to play">
                    <Stack
                      direction="row"
                      spacing={0.25}
                      sx={{
                        alignItems: "center",
                        color: "warning.main",
                      }}
                    >
                      <i
                        className="fas fa-coins"
                        style={{
                          fontSize: "0.95rem",
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
                        {Number(props.game.coinsRequired || 0).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Tooltip>
                )}
              </Stack>
              <Box
                sx={{
                  ml: 0.5,
                  flexShrink: "1",
                  overflowX: "hidden",
                }}
              >
                <Typography
                  noWrap
                  variant="caption"
                  style={{
                    wordBreak: "break-word",
                  }}
                >
                  {filterProfanity(lobbyName, user.settings)}
                </Typography>
              </Box>
              {(showRedoButton || canBreakGame) && (
                <Stack
                  direction="row"
                  spacing={0}
                  sx={{
                    marginLeft: "auto",
                    alignItems: "center",
                  }}
                >
                  {canBreakGame && (
                    <Tooltip title="Break game">
                      <IconButton
                        size="small"
                        onClick={onBreakGameClick}
                        sx={{ color: "text.secondary" }}
                        aria-label="Break game"
                      >
                        <i
                          className="fas fa-car-crash"
                          style={{ fontSize: "1rem" }}
                        />
                      </IconButton>
                    </Tooltip>
                  )}
                  {props.game.status === "Finished" && user.loggedIn && (
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => setIshostGameDialogueOpen(true)}
                    >
                      <i
                        className="rehost fas fa-redo"
                        style={{ fontSize: "1rem" }}
                        title="Rehost"
                      />
                    </IconButton>
                  )}
                </Stack>
              )}
            </Stack>
          )}
          <Setup
            setup={props.game.setup}
            key={props.game.setup.id}
            backgroundColor={getSetupBackgroundColor(props.game, true)}
          />
        </Stack>
      </Stack>
    </div>
    <ConfirmDialog
      open={breakConfirmOpen}
      title="Break Game"
      message="Break this game? This cannot be undone."
      confirmLabel="Break"
      confirmColor="error"
      onClose={() => setBreakConfirmOpen(false)}
      onConfirm={breakGame}
    />
    </>
  );
};
