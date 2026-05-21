import React, { useRef, useEffect, useContext, useState } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  ActionList,
  PlayerList,
  OptionsList,
  SpeechFilter,
  SettingsMenu,
  Notes,
  PinnedMessages,
  MobileLayout,
  GameTypeContext,
} from "./Game";
import { GameContext } from "../../Contexts";
import { Avatar } from "../User/User";
import { Button, Stack, TextField, Typography } from "@mui/material";

import "css/gameAcrotopia.css";

export default function AcrotopiaGame() {
  const game = useContext(GameContext);
  const { history, updateStateViewing, review } = game;
  const playBellRef = useRef(false);

  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    if (review) updateStateViewing({ type: "first" });
  }, [review, updateStateViewing]);

  useSocketListeners((socket) => {
    socket.on("state", () => {
      if (playBellRef.current) game.playAudio("ping");

      playBellRef.current = true;
    });

    socket.on("winners", () => {});
  }, game.socket);

  const playerPanel = (
    <>
      <AcrotopiaRoster />
      <SpeechFilter />
    </>
  );
  const actionPanel = <AcrotopiaActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="acrotopia-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="acrotopia-play-column">
              <AcrotopiaBoard />
              <div className="acrotopia-action-dock">{actionPanel}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="acrotopia-side-chat">
                <TextMeetingLayout />
              </div>
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={<AcrotopiaBoard />}
          innerRightContent={actionPanel}
        />
      </div>
    </GameTypeContext.Provider>
  );
}

function getViewedState(game) {
  return game.history.states?.[game.stateViewing];
}

function getAcrotopiaInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getAcrotopiaMeetings(game) {
  return getViewedState(game)?.meetings || {};
}

function getAcrotopiaMeeting(game, name) {
  return Object.values(getAcrotopiaMeetings(game)).find(
    (meeting) => meeting.name === name && meeting.voting
  );
}

function getPhaseLabel(game) {
  const state = getViewedState(game);

  if (game.stateViewing < 0) return "Pregame";

  return state?.name || "-";
}

function getRound(info) {
  return Number(info.round) || 0;
}

function getTotalRounds(game, info) {
  return (
    Number(info.totalRound) ||
    Number(game.setup?.gameSettings?.roundAmt) ||
    Number(game.options?.gameTypeOptions?.roundAmt) ||
    0
  );
}

function getCurrentAcronym(info) {
  return info.currentAcronym || "";
}

function getAcronymEntries(info) {
  return Array.isArray(info.acronymHistory) ? info.acronymHistory : [];
}

function getScores(info) {
  return info.scores || {};
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

function isAcrotopiaPrimaryMeeting(meeting) {
  return meeting.name === "Give Acronym";
}

function AcrotopiaActions() {
  return (
    <ActionList
      scrollable={false}
      hideIfEmpty
      meetingFilter={(meeting) => !isAcrotopiaPrimaryMeeting(meeting)}
    />
  );
}

function AcrotopiaBoard() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getAcrotopiaInfo(game);
  const acronym = getCurrentAcronym(info);
  const entries = getAcronymEntries(info);
  const scores = getScores(info);
  const playerHasVoted = info.playerHasVoted || {};
  const round = getRound(info);
  const totalRounds = getTotalRounds(game, info);
  const votedCount = Object.values(playerHasVoted).filter(Boolean).length;
  const phase = getPhaseLabel(game);
  const giveAcronymMeeting = getAcrotopiaMeeting(game, "Give Acronym");

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="acrotopia-board acrotopia-board-pregame">
        <div className="acrotopia-stage">
          <div className="acrotopia-board-center">
            <div className="acrotopia-board-kicker">Acrotopia</div>
            <div className="acrotopia-board-title">Waiting for Players</div>
            <div className="acrotopia-board-subtitle">
              The acronym board will open when the first round begins.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="acrotopia-board">
      <div className="acrotopia-statusbar">
        <AcrotopiaMetric label="Phase" value={phase} />
        <AcrotopiaMetric
          label="Round"
          value={totalRounds ? `${round}/${totalRounds}` : round || "-"}
        />
        <AcrotopiaMetric label="Backronyms" value={entries.length} />
        <AcrotopiaMetric label="Votes In" value={votedCount} />
      </div>

      <div className="acrotopia-stage">
        <div className="acrotopia-prompt-panel">
          <div className="acrotopia-board-kicker">Current acronym</div>
          <AcronymTiles acronym={acronym} />
          <AcrotopiaBackronymInput
            acronym={acronym}
            meeting={giveAcronymMeeting}
            socket={game.socket}
            self={game.self}
          />
          <RoundTrack round={round} totalRounds={totalRounds} />
        </div>

        <div className="acrotopia-main-grid">
          <AcronymEntryPanel entries={entries} phase={phase} />
          <ScorePanel scores={scores} playerHasVoted={playerHasVoted} />
        </div>
      </div>
    </section>
  );
}

function AcrotopiaMetric({ label, value }) {
  return (
    <div className="acrotopia-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function AcronymTiles({ acronym }) {
  const letters = acronym ? acronym.split("") : [];

  if (letters.length === 0) {
    return <div className="acrotopia-empty-acronym">No acronym yet</div>;
  }

  return (
    <div className="acrotopia-acronym-tiles" aria-label={acronym}>
      {letters.map((letter, index) => (
        <span key={`${letter}-${index}`}>{letter}</span>
      ))}
    </div>
  );
}

function RoundTrack({ round, totalRounds }) {
  if (!totalRounds) return null;

  return (
    <div className="acrotopia-round-track">
      {Array.from({ length: totalRounds }).map((_, index) => {
        const roundNumber = index + 1;
        const stateClass =
          roundNumber < round
            ? "is-complete"
            : roundNumber === round
            ? "is-current"
            : "is-upcoming";

        return (
          <div
            key={roundNumber}
            className={`acrotopia-round-node ${stateClass}`}
            title={`Round ${roundNumber}`}
          >
            {roundNumber}
          </div>
        );
      })}
    </div>
  );
}

function AcronymEntryPanel({ entries, phase }) {
  const panelTitle = phase === "Night" ? "Submitted backronyms" : "Voting board";

  return (
    <div className="acrotopia-entry-panel">
      <div className="acrotopia-panel-heading">
        <span>{panelTitle}</span>
        <strong>{entries.length}</strong>
      </div>
      {entries.length > 0 ? (
        <div className="acrotopia-entry-list">
          {entries.map((entry, index) => (
            <AcronymEntry key={`${entry.name}-${index}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="acrotopia-empty-state">
          Backronyms will appear here after players submit them.
        </div>
      )}
    </div>
  );
}

function AcronymEntry({ entry }) {
  const isAnonymous = entry.display === "-";
  const author = isAnonymous ? "Anonymous" : entry.display || entry.player;
  const score = Number(entry.score) || 0;

  return (
    <div className={`acrotopia-entry ${entry.isWinner ? "is-winner" : ""}`}>
      <div className="acrotopia-entry-meta">
        <span title={author}>{author}</span>
        <strong>{score}</strong>
      </div>
      <div className="acrotopia-entry-text">{entry.name}</div>
      {Array.isArray(entry.voters) && entry.voters.length > 0 && (
        <div className="acrotopia-entry-voters">
          {entry.voters.length} vote{entry.voters.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function ScorePanel({ scores, playerHasVoted }) {
  const scoreRows = Object.entries(scores).sort(([, scoreA], [, scoreB]) => {
    return Number(scoreB) - Number(scoreA);
  });

  return (
    <div className="acrotopia-score-panel">
      <div className="acrotopia-panel-heading">
        <span>Scoreboard</span>
        <strong>{scoreRows.length}</strong>
      </div>
      {scoreRows.length > 0 ? (
        <div className="acrotopia-score-list">
          {scoreRows.map(([name, score], index) => (
            <AcrotopiaScoreRow
              key={name}
              name={name}
              rank={index + 1}
              score={score}
              hasVoted={playerHasVoted[name]}
            />
          ))}
        </div>
      ) : (
        <div className="acrotopia-empty-state">Scores will appear here.</div>
      )}
    </div>
  );
}

function AcrotopiaScoreRow({ name, rank, score, hasVoted }) {
  const game = useContext(GameContext);
  const player = getPlayerByName(game, name);
  const displayName = getPlayerDisplayName(game, name);

  return (
    <div className={`acrotopia-score-row ${hasVoted ? "has-voted" : ""}`}>
      <div className="acrotopia-score-rank">{rank}</div>
      {player && (
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          name={player.name}
          small
        />
      )}
      <span className="acrotopia-score-name" title={name}>
        {displayName}
      </span>
      {hasVoted && <i className="fas fa-check" title="Voted" />}
      <strong>{score}</strong>
    </div>
  );
}

function AcrotopiaRoster() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getAcrotopiaInfo(game);
  const scores = getScores(info);
  const scoreNames = Object.keys(scores);
  const playerHasVoted = info.playerHasVoted || {};
  const phase = getPhaseLabel(game);

  if (game.stateViewing < 0 || scoreNames.length === 0) {
    return <PlayerList />;
  }

  const orderedNames = scoreNames.sort((nameA, nameB) => {
    return Number(scores[nameB]) - Number(scores[nameA]);
  });

  return (
    <div className="side-menu scrollable acrotopia-roster-menu">
      <div className="title-box">Players</div>
      <div className="side-menu-content">
        <div className="acrotopia-roster">
          {orderedNames.map((name, index) => {
            const player = getPlayerByName(game, name);

            return (
              <AcrotopiaPlayerRow
                key={name}
                player={player}
                name={name}
                position={index + 1}
                score={scores[name]}
                hasVoted={playerHasVoted[name]}
                phase={phase}
                isDead={Boolean(player && state?.dead?.[player.id])}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AcrotopiaPlayerRow({
  player,
  name,
  position,
  score,
  hasVoted,
  phase,
  isDead,
}) {
  const game = useContext(GameContext);
  const displayName = isSelfPlayer(game, player) ? "You" : name;
  const progressLabel = phase === "Night" ? "Done" : "Voted";

  return (
    <button
      type="button"
      className={`acrotopia-player-row ${hasVoted ? "has-voted" : ""} ${
        isDead ? "is-dead" : ""
      }`}
      onClick={() => player && window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="acrotopia-player-position">{position}</span>
      {player && (
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          name={player.name}
          mediumlarge
        />
      )}
      <span className="acrotopia-player-name" title={name}>
        {displayName}
      </span>
      <strong>{score}</strong>
      {hasVoted && <em>{progressLabel}</em>}
    </button>
  );
}

function AcrotopiaBackronymInput({ acronym, meeting, socket, self }) {
  const letters = acronym ? acronym.split("") : [];
  const [wordParts, setWordParts] = useState([]);
  const [submittedText, setSubmittedText] = useState("");

  const textOptions = meeting ? meeting.textOptions || {} : {};
  const maxLength = textOptions.maxLength || 200;
  const disabled = !meeting || meeting.finished || !meeting.amMember;
  const confirmedText = meeting?.votes?.[self] || submittedText;
  const canSubmit = !disabled && letters.length > 0;

  useEffect(() => {
    setWordParts(Array.from({ length: letters.length }, () => ""));
    setSubmittedText(meeting?.votes?.[self] || "");
  }, [acronym, meeting?.id, meeting?.votes, self, letters.length]);

  function sanitizeWordPart(value, letter) {
    let singleWord = value.replace(/\s/g, "");

    if (textOptions.alphaOnlyWithSpaces) {
      singleWord = singleWord.replace(/[^a-z0-9]/gi, "");
    }

    if (
      singleWord.charAt(0).toLowerCase() === letter.charAt(0).toLowerCase()
    ) {
      return singleWord.slice(1);
    }

    return singleWord;
  }

  function handleWordPartChange(index, value) {
    const nextWordParts = [...wordParts];
    nextWordParts[index] = sanitizeWordPart(value, letters[index]);
    setWordParts(nextWordParts);
  }

  function getSubmissionText() {
    return letters
      .map((letter, index) => `${letter}${wordParts[index] || ""}`)
      .join(" ")
      .substring(0, maxLength);
  }

  function handleOnSubmit() {
    if (!canSubmit) return;

    const submittedValue = getSubmissionText();

    meeting.votes[self] = submittedValue;
    socket.send("vote", {
      meetingId: meeting.id,
      selection: submittedValue,
    });
    setSubmittedText(submittedValue);
  }

  if (!meeting) return null;

  return (
    <Stack className="acrotopia-backronym-input" spacing={1}>
      <Typography variant="subtitle2" sx={{ fontFamily: "inherit" }}>
        Finish one word for each letter
      </Typography>
      <div className="acrotopia-word-grid">
        {letters.map((letter, index) => (
          <div className="acrotopia-word-field" key={`${letter}-${index}`}>
            <span>{letter}</span>
            <TextField
              value={wordParts[index] || ""}
              onChange={(e) => handleWordPartChange(index, e.target.value)}
              size="small"
              fullWidth
              disabled={disabled}
              placeholder={`word ${index + 1}`}
              inputProps={{
                "aria-label": `Word ${index + 1} after ${letter}`,
              }}
            />
          </div>
        ))}
      </div>
      <Button
        className="game-action-button acrotopia-backronym-submit"
        variant="contained"
        onClick={handleOnSubmit}
        disabled={!canSubmit}
      >
        {textOptions.submit || "Confirm"}
      </Button>
      {confirmedText && (
        <Typography
          variant="caption"
          sx={{
            color: "var(--mui-palette-success-main)",
            fontFamily: "inherit",
            fontWeight: 700,
            lineHeight: 1.25,
            textAlign: "center",
          }}
        >
          Confirmed: {confirmedText}
        </Typography>
      )}
    </Stack>
  );
}
