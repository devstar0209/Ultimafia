import React, {
  useRef,
  useEffect,
  useContext,
  useState,
  useReducer,
} from "react";
import update from "immutability-helper";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  ActionList,
  PlayerList,
  OptionsList,
  SpeechFilter,
  Notes,
  SettingsMenu,
  PinnedMessages,
  MobileLayout,
  GameTypeContext,
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameJotto.css";
import { Button, Stack, TextField, Typography } from "@mui/material";

const ENGLISH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CHEATSHEET_STATES = [
  undefined,
  "success.main",
  "error.main",
  "info.main",
];
export default function JottoGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const updateStateViewing = game.updateStateViewing;

  const playBellRef = useRef(false);

  // Make player view current state when it changes
  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  // Make game review start at the final state
  useEffect(() => {
    if (game.review) updateStateViewing({ type: "current" });
  }, [game.review, updateStateViewing]);

  // Cycle letters through "none", "correct", "wrong", "maybe"
  const [cheatSheet, updateCheatSheet] = useReducer((state, letter) => {
    if (letter === null) {
      // Let a null signal that we want to reset everything
      return update(state, {
        $set: {},
      });
    } else if (letter in state) {
      return update(state, {
        [letter]: {
          $set: (state[letter] + 1) % CHEATSHEET_STATES.length,
        },
      });
    } else {
      return update(state, {
        [letter]: {
          $set: 1,
        },
      });
    }
  }, {});

  useSocketListeners((socket) => {
    socket.on("state", () => {
      if (playBellRef.current) game.playAudio("ping");

      playBellRef.current = true;
    });

    socket.on("winners", () => {});
  }, game.socket);

  const playerPanel = (
    <>
      <JottoRoster />
      <SpeechFilter />
    </>
  );
  const actionPanel = <JottoActions />;
  const cheatSheetPanel = (
    <JottoCheatSheetMenu
      cheatSheet={cheatSheet}
      updateCheatSheet={updateCheatSheet}
    />
  );

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="jotto-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              {cheatSheetPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="jotto-play-column">
              <JottoBoard />
              <div className="jotto-action-dock">{actionPanel}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="jotto-side-chat">
                <TextMeetingLayout />
              </div>
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={
            <>
              <JottoBoard />
              {cheatSheetPanel}
              <Notes />
            </>
          }
          innerRightContent={
            <>
              <OptionsList />
              {actionPanel}
            </>
          }
          chatTab
        />
      </div>
    </GameTypeContext.Provider>
  );
}

function getViewedState(game) {
  if (game.stateViewing >= 0) return game.history.states?.[game.stateViewing];
  if (game.review && game.stateViewing === -2) {
    return game.history.states?.[-2];
  }

  return null;
}

function getJottoInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getJottoMeetings(game) {
  return getViewedState(game)?.meetings || {};
}

function getJottoMeeting(game, name) {
  return Object.values(getJottoMeetings(game)).find(
    (meeting) => meeting.name === name && meeting.voting
  );
}

function getPhaseLabel(game) {
  if (game.stateViewing < 0) return "Pregame";

  return getViewedState(game)?.name || "-";
}

function getTurnOrder(game) {
  const turnOrder = getJottoInfo(game).turnOrder;

  return Array.isArray(turnOrder) ? turnOrder : [];
}

function getGuessHistoryByNames(game) {
  return getJottoInfo(game).guessHistoryByNames || {};
}

function getPlayerByName(game, playerName) {
  return Object.values(game.players || {}).find(
    (player) => player.name === playerName
  );
}

function isSelfPlayer(game, player) {
  return Boolean(player && player.id === game.self);
}

function getPlayerDisplayName(game, playerName) {
  const player = getPlayerByName(game, playerName);

  return isSelfPlayer(game, player) ? "You" : playerName;
}

function getMeetingPlayer(game, meeting) {
  const memberId =
    meeting?.members?.find((member) => member.canVote)?.id ||
    meeting?.members?.[0]?.id;

  return memberId ? game.players?.[memberId] : null;
}

function getCurrentTurnName(game) {
  return getMeetingPlayer(game, getJottoMeeting(game, "Guess Word"))?.name;
}

function getTotalGuessCount(game) {
  return Object.values(getGuessHistoryByNames(game)).reduce(
    (total, guesses) => total + (Array.isArray(guesses) ? guesses.length : 0),
    0
  );
}

function isJottoPrimaryMeeting(meeting) {
  return meeting.name === "Guess Word" || meeting.name === "Select Word";
}

function JottoActions() {
  return (
    <ActionList
      scrollable={false}
      hideIfEmpty
      meetingFilter={(meeting) => !isJottoPrimaryMeeting(meeting)}
    />
  );
}

function JottoCheatSheetMenu({ cheatSheet, updateCheatSheet }) {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return null;

  return (
    <SideMenu
      title="Letter Board"
      content={
        <JottoCheatSheet
          cheatSheet={cheatSheet}
          updateCheatSheet={updateCheatSheet}
        />
      }
      flex="0 0 auto"
    />
  );
}

function JottoBoard() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getJottoInfo(game);
  const turnOrder = getTurnOrder(game);
  const guessHistoryByNames = getGuessHistoryByNames(game);
  const guessMeeting = getJottoMeeting(game, "Guess Word");
  const selectWordMeeting = getJottoMeeting(game, "Select Word");
  const currentTurnName = getCurrentTurnName(game);
  const wordLength =
    Number(info.wordLength) ||
    Number(game.options?.gameTypeOptions?.wordLength) ||
    Number(game.setup?.gameSettings?.wordLength) ||
    "-";

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="jotto-board jotto-board-pregame">
        <div className="jotto-board-center">
          <div className="jotto-board-kicker">Jotto</div>
          <div className="jotto-board-title">Waiting for Players</div>
          <div className="jotto-board-subtitle">
            The deduction board opens once the game starts.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="jotto-board">
      <div className="jotto-statusbar">
        <JottoMetric label="Phase" value={getPhaseLabel(game)} />
        <JottoMetric label="Word Length" value={wordLength} />
        <JottoMetric label="Players" value={turnOrder.length || "-"} />
        <JottoMetric label="Guesses" value={getTotalGuessCount(game)} />
        <JottoMetric
          label="Turn"
          value={
            currentTurnName ? getPlayerDisplayName(game, currentTurnName) : "-"
          }
        />
      </div>

      <div className="jotto-table">
        {turnOrder.length > 0 ? (
          <div className="jotto-history-grid">
            {turnOrder.map((name) => (
              <JottoHistoryPanel
                key={name}
                name={name}
                guessHistory={guessHistoryByNames[name]}
                guessMeeting={guessMeeting}
                socket={game.socket}
                self={game.self}
                players={game.players}
                isActive={name === currentTurnName}
              />
            ))}
          </div>
        ) : (
          <div className="jotto-select-word">
            <div className="jotto-select-card">
              <div className="jotto-board-kicker">Secret Word</div>
              <div className="jotto-board-title">Choose your word</div>
              <JottoGuessInput
                meeting={selectWordMeeting}
                socket={game.socket}
                self={game.self}
                isMyTurn={
                  selectWordMeeting &&
                  selectWordMeeting.amMember &&
                  selectWordMeeting.canVote
                }
                placeholder="Select word"
                label={selectWordMeeting?.actionName || "Select Word"}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function JottoMetric({ label, value }) {
  return (
    <div className="jotto-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function JottoRoster() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const turnOrder = getTurnOrder(game);
  const currentTurnName = getCurrentTurnName(game);

  if (game.stateViewing < 0 || turnOrder.length === 0) {
    return <PlayerList />;
  }

  return (
    <div className="side-menu scrollable jotto-roster-menu">
      <div className="title-box">Players</div>
      <div className="side-menu-content">
        <div className="jotto-roster">
          {turnOrder.map((name, index) => {
            const player = getPlayerByName(game, name);

            return (
              <JottoPlayerRow
                key={name}
                player={player}
                name={name}
                position={index + 1}
                isActive={name === currentTurnName}
                isDead={Boolean(player && state?.dead?.[player.id])}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function JottoPlayerRow({ player, name, position, isActive, isDead }) {
  const game = useContext(GameContext);
  const displayName = isSelfPlayer(game, player) ? "You" : name;

  return (
    <button
      type="button"
      className={`jotto-player-row ${isActive ? "is-active" : ""} ${
        isDead ? "is-dead" : ""
      }`}
      onClick={() => player && window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="jotto-player-position">{position}</span>
      {player && (
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          name={player.name}
          mediumlarge
        />
      )}
      <span className="jotto-player-name" title={name}>
        {displayName}
      </span>
      {isActive && <em>Turn</em>}
    </button>
  );
}

function JottoCheatSheet({ cheatSheet, updateCheatSheet }) {
  return (
    <Stack
      direction="row"
      sx={{
        flexWrap: "wrap",
        p: 1,
        rowGap: 0.5,
        columnGap: 0.5,
        alignContent: "center",
        justifyContent: "center",
      }}
    >
      {ENGLISH_ALPHABET.map((letter) => {
        const clicks = cheatSheet[letter] || 0;

        return (
          <Button
            key={letter}
            onClick={() => updateCheatSheet(letter)}
            variant="text"
            sx={{
              position: "relative",
              minWidth: "0",
              width: "3em",
              height: "3em",
              zIndex: 1,
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: CHEATSHEET_STATES[clicks],
                border: "1px solid var(--mui-palette-primary-main)",
                borderRadius: "var(--mui-shape-borderRadius)",
                opacity: 0.5,
                zIndex: -1,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: "2em",
                fontWeight: "bold",
                color: "var(--mui-palette-text-primary)",
              }}
            >
              {letter}
            </Typography>
          </Button>
        );
      })}
      <Button
        onClick={() => updateCheatSheet(null)}
        sx={{
          height: "3em",
        }}
      >
        Reset
      </Button>
      <Typography
        variant="caption"
        sx={{
          flexBasis: "100%",
          color: "var(--mui-palette-text-secondary)",
          fontFamily: "inherit",
          lineHeight: 1.35,
          px: 1,
          textAlign: "center",
        }}
      >
        Use this to track which letters seem correct, wrong, or possible while
        you solve.
      </Typography>
    </Stack>
  );
}

function JottoHistoryPanel({
  name,
  guessHistory,
  guessMeeting,
  socket,
  self,
  players,
  isActive,
}) {
  const player = Object.values(players || {}).find((p) => p.name === name);
  const isSelf = player && player.id === self;
  const displayName = isSelf ? "You" : name;
  const isMyTurn =
    isSelf && guessMeeting && guessMeeting.amMember && guessMeeting.canVote;

  return (
    <div className={`jotto-history-panel ${isActive ? "is-active" : ""}`}>
      <div className="jotto-panel-header">
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "center", p: 1, pt: 3 }}
        >
          {player && (
            <Avatar
              id={player.userId}
              name={player.name}
              hasImage={player.avatar}
              small
            />
          )}
          <Typography
            variant="h6"
            sx={{ fontWeight: "bold", fontFamily: "inherit" }}
            title={name}
          >
            {displayName}
          </Typography>
        </Stack>
        {isSelf ? (
          <JottoGuessInput
            meeting={guessMeeting}
            socket={socket}
            self={self}
            isMyTurn={isMyTurn}
          />
        ) : (
          <div className="jotto-guess-input-spacer" />
        )}
      </div>
      <div className="jotto-panel-guesses">
        <JottoGuessHistoryByName guessHistory={guessHistory} />
      </div>
    </div>
  );
}

function JottoGuessInput({ meeting, socket, self, isMyTurn, placeholder, label }) {
  const [textData, setTextData] = useState("");
  const [submittedText, setSubmittedText] = useState("");

  const textOptions = meeting ? meeting.textOptions || {} : {};
  const minLength = textOptions.minLength || 0;
  const maxLength = textOptions.maxLength || 50;
  const disabled = !isMyTurn || !meeting || meeting.finished;
  const confirmedText = meeting?.votes?.[self] || submittedText;

  useEffect(() => {
    setSubmittedText(meeting?.votes?.[self] || "");
    setTextData("");
  }, [meeting?.id, meeting?.votes, self]);

  function handleOnChange(e) {
    let textInput = e.target.value;
    if (textOptions.alphaOnly) {
      textInput = textInput.replace(/[^a-z]/gi, "");
    }
    if (textOptions.toLowerCase) {
      textInput = textInput.toLowerCase();
    }
    textInput = textInput.substring(0, maxLength);
    setTextData(textInput);
  }

  function handleOnSubmit() {
    if (!meeting || textData.length < minLength || disabled) return;
    const submittedValue = textData;

    meeting.votes[self] = submittedValue;
    socket.send("vote", {
      meetingId: meeting.id,
      selection: submittedValue,
    });
    setSubmittedText(submittedValue);
    setTextData("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleOnSubmit();
    }
  }

  return (
    <Stack
      spacing={0.5}
      sx={{
        px: 1,
        pb: 0.5,
        opacity: disabled ? 0.4 : 1,
        alignItems: "center",
        maxWidth: "280px",
        mx: "auto",
      }}
    >
      {label && (
        <Typography variant="subtitle2" sx={{ fontFamily: "inherit" }}>
          {label}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ width: "100%", alignItems: "center" }}
      >
        <TextField
          value={textData}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          size="small"
          fullWidth
          disabled={disabled}
          placeholder={placeholder || "Guess word"}
          sx={{
            "& .MuiInputBase-root": {
              minHeight: "40px",
              borderRadius: "8px",
            },
            "& .MuiInputBase-input": {
              py: "8px",
              px: 1.25,
              fontSize: "0.95rem",
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleOnSubmit}
          disabled={disabled || textData.length < minLength}
          size="small"
          sx={{
            minWidth: "86px",
            minHeight: "40px",
            px: 1.5,
            py: "7px",
            borderRadius: "8px",
            fontSize: "0.82rem",
            fontWeight: 800,
          }}
        >
          {textOptions.submit || "Confirm"}
        </Button>
      </Stack>
      {confirmedText && (
        <Typography
          variant="caption"
          sx={{
            alignSelf: "stretch",
            color: "var(--mui-palette-success-main)",
            fontFamily: "inherit",
            fontWeight: 700,
            lineHeight: 1.25,
            textAlign: "left",
          }}
        >
          Confirmed: {confirmedText}
        </Typography>
      )}
    </Stack>
  );
}

function JottoGuessHistoryByName(props) {
  const guessHistory = props.guessHistory || [];

  return (
    <div className="jotto-guess-history">
      {guessHistory.map((g, i) => (
        <JottoGuess key={i} word={g.word} score={g.score} />
      ))}
    </div>
  );
}

function JottoGuess(props) {
  let word = props.word;
  let score = props.score;
  let [checked, setChecked] = useState();

  function toggleChecked() {
    setChecked(!checked);
  }

  const checkedClass = checked ? "done" : "";

  return (
    <>
      <div className="jotto-guess">
        {score === null ? (
          <div className={"jotto-guess-score forbidden"}>!</div>
        ) : (
          <div className={`jotto-guess-score guess-score-${score}`}>
            {score}
          </div>
        )}
        <div
          className={`jotto-guess-word ${checkedClass}`}
          onClick={toggleChecked}
        >
          {word}
        </div>
      </div>
    </>
  );
}
