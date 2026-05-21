import React, { useRef, useEffect, useContext } from "react";

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

import "../../css/gameWackyWords.css";

export default function WackyWordsGame() {
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
      <WackyWordsRoster />
      <SpeechFilter />
    </>
  );
  const actionPanel = <WackyWordsActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="wacky-words-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="wacky-words-play-column">
              <WackyWordsBoard />
              <div className="wacky-words-action-dock">{actionPanel}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="wacky-words-side-chat">
                <TextMeetingLayout />
              </div>
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={<WackyWordsBoard />}
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

function getWackyWordsInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getPhaseLabel(game) {
  if (game.stateViewing < 0) return "Pregame";

  return getViewedState(game)?.name || "-";
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

function getResponseHistory(info) {
  return Array.isArray(info.responseHistory) ? info.responseHistory : [];
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

function sortScores(scores) {
  return Object.entries(scores).sort(([, scoreA], [, scoreB]) => {
    return Number(scoreB) - Number(scoreA);
  });
}

function WackyWordsActions() {
  return <ActionList scrollable={false} hideIfEmpty />;
}

function WackyWordsBoard() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getWackyWordsInfo(game);
  const responses = getResponseHistory(info);
  const scores = getScores(info);
  const playerHasVoted = info.playerHasVoted || {};
  const round = getRound(info);
  const totalRounds = getTotalRounds(game, info);
  const votedCount = Object.values(playerHasVoted).filter(Boolean).length;
  const phase = getPhaseLabel(game);
  const currentQuestion = info.currentQuestion || "";
  const leaderName = sortScores(scores)[0]?.[0];

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="wacky-words-board wacky-words-board-pregame">
        <div className="wacky-words-stage">
          <div className="wacky-words-board-center">
            <div className="wacky-words-board-kicker">Wacky Words</div>
            <div className="wacky-words-board-title">Waiting for Players</div>
            <div className="wacky-words-board-subtitle">
              The prompt board opens once the first round begins.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wacky-words-board">
      <div className="wacky-words-statusbar">
        <WackyWordsMetric label="Phase" value={phase} />
        <WackyWordsMetric
          label="Round"
          value={totalRounds ? `${round}/${totalRounds}` : round || "-"}
        />
        <WackyWordsMetric label="Responses" value={responses.length} />
        <WackyWordsMetric label="Votes In" value={votedCount} />
        <WackyWordsMetric
          label="Leader"
          value={leaderName ? getPlayerDisplayName(game, leaderName) : "-"}
        />
      </div>

      <div className="wacky-words-stage">
        <div className="wacky-words-prompt-panel">
          <div className="wacky-words-board-kicker">Current prompt</div>
          <WackyWordsPrompt question={currentQuestion} />
          <RoundTrack round={round} totalRounds={totalRounds} />
        </div>

        <div className="wacky-words-main-grid">
          <ResponsePanel responses={responses} phase={phase} />
          <ScorePanel scores={scores} playerHasVoted={playerHasVoted} />
        </div>
      </div>
    </section>
  );
}

function WackyWordsMetric({ label, value }) {
  return (
    <div className="wacky-words-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function WackyWordsPrompt({ question }) {
  if (Array.isArray(question)) {
    return (
      <div className="wacky-words-decision-options">
        {question.map((option, index) => (
          <div key={`${option}-${index}`} className="wacky-words-decision-card">
            <span>Option {index + 1}</span>
            <strong>{option}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (!question) {
    return <div className="wacky-words-empty-prompt">No prompt yet</div>;
  }

  const isAcronym = /^[A-Z]{3,8}$/.test(question);

  if (isAcronym) {
    return (
      <div className="wacky-words-letter-tiles" aria-label={question}>
        {question.split("").map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
      </div>
    );
  }

  return <div className="wacky-words-prompt-text">{question}</div>;
}

function RoundTrack({ round, totalRounds }) {
  if (!totalRounds) return null;

  return (
    <div className="wacky-words-round-track">
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
            className={`wacky-words-round-node ${stateClass}`}
            title={`Round ${roundNumber}`}
          >
            {roundNumber}
          </div>
        );
      })}
    </div>
  );
}

function ResponsePanel({ responses, phase }) {
  const panelTitle = phase === "Night" ? "Submitted responses" : "Voting board";

  return (
    <div className="wacky-words-response-panel">
      <div className="wacky-words-panel-heading">
        <span>{panelTitle}</span>
        <strong>{responses.length}</strong>
      </div>
      {responses.length > 0 ? (
        <div className="wacky-words-response-list">
          {responses.map((response, index) => (
            <ResponseEntry
              key={`${response.name}-${response.player}-${index}`}
              response={response}
            />
          ))}
        </div>
      ) : (
        <div className="wacky-words-empty-state">
          Responses will appear here after players submit them.
        </div>
      )}
    </div>
  );
}

function ResponseEntry({ response }) {
  const isAnonymous = response.display === "-";
  const author = isAnonymous
    ? "Anonymous"
    : response.display || response.player || "Player";
  const score = Number(response.score) || 0;
  const voters = Array.isArray(response.voters) ? response.voters : [];

  return (
    <div
      className={`wacky-words-response ${
        response.isWinner ? "is-winner" : ""
      }`}
    >
      <div className="wacky-words-response-meta">
        <span title={author}>{author}</span>
        <strong>{score}</strong>
      </div>
      <div className="wacky-words-response-text">{response.name}</div>
      {voters.length > 0 && (
        <div className="wacky-words-response-voters">
          {voters.length} vote{voters.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function ScorePanel({ scores, playerHasVoted }) {
  const scoreRows = sortScores(scores);

  return (
    <div className="wacky-words-score-panel">
      <div className="wacky-words-panel-heading">
        <span>Scoreboard</span>
        <strong>{scoreRows.length}</strong>
      </div>
      {scoreRows.length > 0 ? (
        <div className="wacky-words-score-list">
          {scoreRows.map(([name, score], index) => (
            <WackyWordsScoreRow
              key={name}
              name={name}
              rank={index + 1}
              score={score}
              hasVoted={playerHasVoted[name]}
            />
          ))}
        </div>
      ) : (
        <div className="wacky-words-empty-state">Scores will appear here.</div>
      )}
    </div>
  );
}

function WackyWordsScoreRow({ name, rank, score, hasVoted }) {
  const game = useContext(GameContext);
  const player = getPlayerByName(game, name);
  const displayName = getPlayerDisplayName(game, name);

  return (
    <div className={`wacky-words-score-row ${hasVoted ? "has-voted" : ""}`}>
      <div className="wacky-words-score-rank">{rank}</div>
      {player && (
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          name={player.name}
          small
        />
      )}
      <span className="wacky-words-score-name" title={name}>
        {displayName}
      </span>
      {hasVoted && <i className="fas fa-check" title="Submitted" />}
      <strong>{score}</strong>
    </div>
  );
}

function WackyWordsRoster() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getWackyWordsInfo(game);
  const scores = getScores(info);
  const scoreRows = sortScores(scores);
  const playerHasVoted = info.playerHasVoted || {};
  const phase = getPhaseLabel(game);

  if (game.stateViewing < 0 || scoreRows.length === 0) {
    return <PlayerList />;
  }

  return (
    <div className="side-menu scrollable wacky-words-roster-menu">
      <div className="title-box">Players</div>
      <div className="side-menu-content">
        <div className="wacky-words-roster">
          {scoreRows.map(([name, score], index) => {
            const player = getPlayerByName(game, name);

            return (
              <WackyWordsPlayerRow
                key={name}
                player={player}
                name={name}
                position={index + 1}
                score={score}
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

function WackyWordsPlayerRow({
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
  const progressLabel = phase === "Day" ? "Voted" : "Done";

  return (
    <button
      type="button"
      className={`wacky-words-player-row ${hasVoted ? "has-voted" : ""} ${
        isDead ? "is-dead" : ""
      }`}
      onClick={() => player && window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="wacky-words-player-position">{position}</span>
      {player && (
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          name={player.name}
          mediumlarge
        />
      )}
      <span className="wacky-words-player-name" title={name}>
        {displayName}
      </span>
      <strong>{score}</strong>
      {hasVoted && <em>{progressLabel}</em>}
    </button>
  );
}
