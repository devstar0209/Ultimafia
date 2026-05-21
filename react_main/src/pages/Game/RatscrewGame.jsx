import React, { useRef, useEffect, useContext } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  OptionsList,
  PlayerList,
  SettingsMenu,
  TextMeetingLayout,
  Notes,
  MobileLayout,
  GameTypeContext,
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { cardGameAudioConfig } from "../../audio/audioConfigs";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameCardGames.css";
import "../../css/gameRatscrew.css";

export default function RatscrewGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const stateViewing = game.stateViewing;
  const updateStateViewing = game.updateStateViewing;
  const loadAudioFiles = game.loadAudioFiles;
  const review = game.review;

  const playBellRef = useRef(false);

  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    loadAudioFiles(cardGameAudioConfig);

    if (review) updateStateViewing({ type: "first" });
  }, [loadAudioFiles, review, updateStateViewing]);

  useSocketListeners((socket) => {
    socket.on("state", () => {
      if (playBellRef.current) game.playAudio("ping");

      playBellRef.current = true;
    });

    socket.on("winners", () => {});
    socket.on("cardShuffle", () => {
      game.playAudio("cardShuffle");
    });
    socket.on("chips_large1", () => {
      game.playAudio("chips_large1");
    });
    socket.on("chips_large2", () => {
      game.playAudio("chips_large2");
    });
    socket.on("chips_small1", () => {
      game.playAudio("chips_small1");
    });
    socket.on("chips_small2", () => {
      game.playAudio("chips_small2");
    });
  }, game.socket);

  const playerList = (
    <>
      {stateViewing < 0 && <PlayerList />}
      <RatscrewRoster />
    </>
  );

  const actionList = <RatscrewActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="ratscrew-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerList}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="ratscrew-play-column">
              <RatscrewTable actionContent={actionList} />
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="ratscrew-side-chat">
                <TextMeetingLayout />
              </div>
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerList}
          additionalInfoContent={<RatscrewTable actionContent={actionList} />}
          innerRightContent={
            <>
              <OptionsList />
              <RatscrewRoundInfo />
              <RatscrewActions />
            </>
          }
        />
      </div>
    </GameTypeContext.Provider>
  );
}

function getViewedState(game) {
  return game.history.states?.[game.stateViewing];
}

function getExtraInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getPlayers(extraInfo) {
  return Array.isArray(extraInfo.randomizedPlayers)
    ? extraInfo.randomizedPlayers
    : [];
}

function getStack(extraInfo) {
  return Array.isArray(extraInfo.TheStack) ? extraInfo.TheStack : [];
}

function getCurrentTurnPlayer(players, extraInfo) {
  return players.find((player) => player.userId === extraInfo.whoseTurnIsIt);
}

function getSelfPlayer(players, self) {
  return players.find((player) => player.playerId === self);
}

function getPlayerDisplayName(player, self) {
  return player.playerId === self ? "You" : player.playerName;
}

function getSeatRails(players, self) {
  const selfPlayer = players.find((player) => player.playerId === self);

  if (!selfPlayer) {
    const splitIndex = Math.ceil(players.length / 2);

    return {
      top: players.slice(0, splitIndex),
      bottom: players.slice(splitIndex),
    };
  }

  return {
    top: players.filter((player) => player.playerId !== self),
    bottom: [selfPlayer],
  };
}

function getCardRank(card) {
  return typeof card === "string" ? card.split("-")[0] : "";
}

function getTopCards(stack) {
  return {
    topCard: stack[stack.length - 1],
    secondCard: stack[stack.length - 2],
  };
}

function getRatscrewMeetings(game) {
  const meetings = Object.values(getViewedState(game)?.meetings || {});

  return {
    playCardMeeting: meetings.find(
      (meeting) =>
        meeting.inputType === "boolean" &&
        (meeting.name === "Play Card" || meeting.actionName === "Play Card")
    ),
    slapMeeting: meetings.find(
      (meeting) => meeting.name === "Slap" || meeting.actionName === "Slap"
    ),
    challengeMeeting: meetings.find(
      (meeting) =>
        meeting.name === "Call Lie" || meeting.actionName === "Call Lie"
    ),
  };
}

function canUseMeeting(game, meeting) {
  if (!meeting) return false;

  const isCurrentState = game.stateViewing === game.history.currentState;
  const hasVoted = meeting.votes?.[game.self];
  const lockedAfterVote =
    ((meeting.instant && !meeting.instantButChangeable) || meeting.noUnvote) &&
    hasVoted;

  return (
    isCurrentState &&
    meeting.amMember &&
    meeting.canVote &&
    !lockedAfterVote
  );
}

function PlayingCard({ value, hidden = false, blank = false, className = "" }) {
  const cardClass = blank ? "card-blank" : hidden ? "card-unknown" : `c${value}`;

  return (
    <div
      className={`card ratscrew-playing-card ${cardClass} ${className}`}
      aria-label={blank ? "Empty card slot" : hidden ? "Hidden card" : value}
    />
  );
}

function RatscrewActions() {
  const game = useContext(GameContext);
  const {
    playCardMeeting,
    slapMeeting,
    challengeMeeting,
  } = getRatscrewMeetings(game);

  if (game.stateViewing < 0) return null;

  return (
    <div className="ratscrew-actions">
      {playCardMeeting && <RatscrewPlayAction meeting={playCardMeeting} />}
      {slapMeeting && (
        <RatscrewChoiceActions
          meeting={slapMeeting}
          labels={{
            Slap: "Slap",
            "Don't Slap": "Hold",
          }}
          dangerTargets={["Slap"]}
        />
      )}
      {challengeMeeting && (
        <RatscrewChoiceActions
          meeting={challengeMeeting}
          labels={{
            "Challenge Slap": "Challenge",
            "Don't Challenge Slap": "Pass",
          }}
          dangerTargets={["Challenge Slap"]}
        />
      )}
    </div>
  );
}

function RatscrewPlayAction({ meeting }) {
  const game = useContext(GameContext);
  const canAct = canUseMeeting(game, meeting);
  const selectedAction = meeting.votes?.[game.self];

  function playCard() {
    if (!canAct) return;

    meeting.votes[game.self] = "Yes";
    game.socket.send("vote", {
      meetingId: meeting.id,
      selection: "Yes",
    });
  }

  return (
    <button
      type="button"
      className={`ratscrew-action-button ratscrew-action-play ${
        selectedAction === "Yes" ? "is-selected" : ""
      }`}
      disabled={!canAct}
      onClick={playCard}
    >
      Play Card
    </button>
  );
}

function RatscrewChoiceActions({ meeting, labels, dangerTargets = [] }) {
  const game = useContext(GameContext);
  const selectedAction = meeting.votes?.[game.self];
  const canAct = canUseMeeting(game, meeting);

  function submitAction(target) {
    if (!canAct) return;

    meeting.votes[game.self] = target;
    game.socket.send("vote", {
      meetingId: meeting.id,
      selection: target,
    });
  }

  return (
    <div className="ratscrew-choice-actions">
      {(meeting.targets || []).map((target) => (
        <button
          key={target}
          type="button"
          className={`ratscrew-action-button ${
            dangerTargets.includes(target)
              ? "ratscrew-action-danger"
              : "ratscrew-action-pass"
          } ${selectedAction === target ? "is-selected" : ""}`}
          disabled={!canAct}
          onClick={() => submitAction(target)}
        >
          {labels[target] || target}
        </button>
      ))}
    </div>
  );
}

function RatscrewTable({ actionContent }) {
  const game = useContext(GameContext);
  const state = getViewedState(game);

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="ratscrew-table-stage ratscrew-table-stage-pregame">
        <div className="ratscrew-table-felt">
          <div className="ratscrew-table-center">
            <div className="ratscrew-table-kicker">Ratscrew</div>
            <div className="ratscrew-table-title">Waiting for players</div>
            <div className="ratscrew-table-subtitle">
              The table opens once the first card is dealt.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const extraInfo = state.extraInfo || {};
  const players = getPlayers(extraInfo);
  const stack = getStack(extraInfo);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);
  const selfPlayer = getSelfPlayer(players, game.self);
  const seatRails = getSeatRails(players, game.self);
  const activePlayers = players.filter(
    (player) => (player.CardsInHand || []).length > 0
  );

  return (
    <section
      className={`ratscrew-table-stage ${
        extraInfo.isTheFlyingDutchman ? "is-dutchman" : ""
      }`}
    >
      <div className="ratscrew-table-statusbar">
        <RatscrewMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
        <RatscrewMetric label="Turn" value={currentTurnPlayer?.playerName || "-"} />
        <RatscrewMetric label="Stack" value={stack.length} />
        <RatscrewMetric
          label="Top Card"
          value={getCardRank(getTopCards(stack).topCard) || "-"}
        />
        <RatscrewMetric
          label="Players"
          value={`${activePlayers.length || players.length}/${players.length}`}
        />
      </div>

      <div className="ratscrew-table-felt">
        <div className="ratscrew-seat-rail ratscrew-seat-rail-top">
          {seatRails.top.map((player) => (
            <RatscrewSeat
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>

        <div className="ratscrew-table-center">
          <RatscrewStackSummary stack={stack} />
        </div>

        <div className="ratscrew-seat-rail ratscrew-seat-rail-bottom">
          {seatRails.bottom.map((player) => (
            <RatscrewSeat
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>
      </div>

      <div className="ratscrew-table-footer">
        <div className="ratscrew-hero-hand">
          <span>Your deck</span>
          <RatscrewDeckLine cards={selfPlayer?.CardsInHand || []} />
        </div>
        {actionContent && (
          <div className="ratscrew-table-actions">{actionContent}</div>
        )}
      </div>
    </section>
  );
}

function RatscrewMetric({ label, value }) {
  return (
    <div className="ratscrew-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RatscrewStackSummary({ stack, compact = false }) {
  const { topCard, secondCard } = getTopCards(stack);
  const isPair =
    topCard && secondCard && getCardRank(topCard) === getCardRank(secondCard);

  return (
    <div className={`ratscrew-stack-summary ${compact ? "is-compact" : ""}`}>
      <div className="ratscrew-stack-cards" aria-label="Stack">
        <PlayingCard
          value={secondCard}
          hidden={!secondCard}
          blank={stack.length === 0}
          className="ratscrew-stack-card ratscrew-stack-card-back"
        />
        <PlayingCard
          value={topCard}
          hidden={!topCard}
          blank={stack.length === 0}
          className="ratscrew-stack-card ratscrew-stack-card-top"
        />
      </div>
      <div className="ratscrew-stack-copy">
        <span>{isPair ? "Pair showing" : "Top of stack"}</span>
        <strong>{getCardRank(topCard) || "Empty"}</strong>
      </div>
    </div>
  );
}

function RatscrewDeckLine({ cards, small = false }) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const visibleBacks = Math.min(safeCards.length, small ? 6 : 10);

  if (safeCards.length === 0) {
    return <div className="ratscrew-deck-line is-empty">No cards</div>;
  }

  return (
    <div className={`ratscrew-deck-line ${small ? "is-small" : ""}`}>
      <div className="ratscrew-deck-count">
        <strong>{safeCards.length}</strong>
        <span>{safeCards.length === 1 ? "card" : "cards"}</span>
      </div>
      <div className="ratscrew-deck-cards">
        {Array.from({ length: visibleBacks }).map((_, index) => (
          <PlayingCard
            key={index}
            hidden
            className={small ? "ratscrew-playing-card-small" : ""}
          />
        ))}
      </div>
    </div>
  );
}

function RatscrewSeat({ player, isCurrentPlayer, isTurn }) {
  const game = useContext(GameContext);
  const gamePlayer = game.players?.[player.playerId] || {};
  const displayName = getPlayerDisplayName(player, game.self);
  const cardCount = Array.isArray(player.CardsInHand)
    ? player.CardsInHand.length
    : 0;

  return (
    <button
      type="button"
      className={`ratscrew-seat ${isCurrentPlayer ? "is-self" : ""} ${
        isTurn ? "is-turn" : ""
      } ${cardCount === 0 ? "is-empty" : ""}`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="ratscrew-seat-avatar">
        <Avatar
          hasImage={gamePlayer.avatar}
          id={gamePlayer.userId || player.userId}
          name={player.playerName}
          mediumlarge
        />
      </span>
      <span className="ratscrew-seat-name" title={player.playerName}>
        {displayName}
      </span>
      <span className="ratscrew-seat-card-count">{cardCount} cards</span>
    </button>
  );
}

export function RatscrewRoundInfo() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);
  const stack = getStack(extraInfo);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);

  return (
    <SideMenu
      title="Round Info"
      scrollable
      content={
        <div className="ratscrew-info-panel">
          <RatscrewMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
          <RatscrewMetric label="Stack" value={stack.length} />
          <RatscrewMetric
            label="Action"
            value={currentTurnPlayer?.playerName || "-"}
          />
          <RatscrewStackSummary stack={stack} compact />
        </div>
      }
    />
  );
}

function RatscrewRoster() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);

  return (
    <SideMenu
      title="Seats"
      scrollable
      content={
        <div className="ratscrew-roster">
          {players.map((player) => (
            <RatscrewPlayerRow
              key={player.userId || player.playerName}
              userId={player.userId}
              playerName={getPlayerDisplayName(player, game.self)}
              cards={player.CardsInHand}
              isCurrentPlayer={player.playerId === game.self}
              isTheFlyingDutchman={extraInfo.isTheFlyingDutchman}
              whoseTurnIsIt={extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>
      }
    />
  );
}

function RatscrewPlayerRow({
  userId,
  playerName,
  cards,
  isCurrentPlayer,
  isTheFlyingDutchman,
  whoseTurnIsIt,
}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const isSamePlayer = whoseTurnIsIt === userId;

  return (
    <div
      className={`ratscrew-player-row ${isCurrentPlayer ? "is-self" : ""} ${
        isSamePlayer ? "is-turn" : ""
      } ${safeCards.length === 0 ? "is-empty" : ""}`}
    >
      <button
        type="button"
        className="ratscrew-player-name"
        style={
          isTheFlyingDutchman
            ? {
                backgroundColor: isCurrentPlayer ? "#506D56" : "#48654e",
                borderColor: "#3B5841",
              }
            : {}
        }
        onClick={() => window.open(`/user/${userId}`, "_blank")}
      >
        {playerName}
      </button>
      <RatscrewDeckLine cards={safeCards} small />
    </div>
  );
}
