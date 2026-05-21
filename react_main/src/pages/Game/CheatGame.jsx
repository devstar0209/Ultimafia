import React, { useRef, useEffect, useContext, useState } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  OptionsList,
  PlayerList,
  SettingsMenu,
  Notes,
  MobileLayout,
  GameTypeContext,
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { cardGameAudioConfig } from "../../audio/audioConfigs";
import { Avatar } from "../User/User";
import CheckIcon from "@mui/icons-material/Check";

import "css/game.css";
import "css/gameCardGames.css";
import "../../css/gameCheat.css";

export default function CheatGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const stateViewing = game.stateViewing;
  const updateStateViewing = game.updateStateViewing;
  const loadAudioFiles = game.loadAudioFiles;
  const review = game.review;

  const playBellRef = useRef(false);

  // Make player view current state when it changes
  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    loadAudioFiles(cardGameAudioConfig);

    // Make game review start at pregame
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
      <CheatRoster />
    </>
  );
  const cheatMeetings = getCheatMeetings(game);
  const cardSelection = useCheatCardSelection(cheatMeetings.playCardsMeeting);

  const actionList = (
    <CheatActions cheatMeetings={cheatMeetings} cardSelection={cardSelection} />
  );

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="cheat-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerList}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="cheat-play-column">
              <CheatTable
                playCardsMeeting={cheatMeetings.playCardsMeeting}
                cardSelection={cardSelection}
                actionContent={actionList}
              />
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="cheat-side-chat">
                <TextMeetingLayout />
              </div>
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerList}
          additionalInfoContent={
            <CheatTable
              playCardsMeeting={cheatMeetings.playCardsMeeting}
              cardSelection={cardSelection}
              actionContent={actionList}
            />
          }
          innerRightContent={
            <>
              <OptionsList />
              <CheatRoundInfo />
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

function getSelfPlayer(players, self) {
  return players.find((player) => player.playerId === self);
}

function getCurrentTurnPlayer(players, extraInfo) {
  return players.find((player) => player.userId === extraInfo.whoseTurnIsIt);
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

function getRankLabel(rankNumber) {
  const rank = Number(rankNumber);

  if (rank === 1) return "Ace";
  if (rank === 11) return "Jack";
  if (rank === 12) return "Queen";
  if (rank === 13) return "King";
  if (rank > 1 && rank < 11) return String(rank);

  return "-";
}

function getRankPlural(rankNumber) {
  const rankLabel = getRankLabel(rankNumber);

  if (rankLabel === "-") return "-";
  if (rankLabel === "6") return "6s";

  return `${rankLabel}s`;
}

function getStack(extraInfo) {
  return Array.isArray(extraInfo.TheStack) ? extraInfo.TheStack : [];
}

function getCheatMeetings(game) {
  const meetings = Object.values(getViewedState(game)?.meetings || {});

  return {
    playCardsMeeting: meetings.find(
      (meeting) => meeting.inputType === "playingCardButtons"
    ),
    submitMeeting: meetings.find(
      (meeting) =>
        meeting.inputType === "boolean" &&
        (meeting.name === "Submit" || meeting.actionName === "Submit")
    ),
    callLieMeeting: meetings.find(
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
      className={`card cheat-playing-card ${cardClass} ${className}`}
      aria-label={blank ? "Empty card slot" : hidden ? "Hidden card" : value}
    />
  );
}

function useCheatCardSelection(meeting) {
  const game = useContext(GameContext);
  const serverSelectedCards = Array.isArray(meeting?.votes?.[game.self])
    ? meeting.votes[game.self]
    : [];
  const serverSelectedKey = serverSelectedCards.join("|");
  const [localSelectedCards, setLocalSelectedCards] =
    useState(serverSelectedCards);
  const selectedCards = localSelectedCards;
  const selectedCardSet = new Set(selectedCards);
  const minCards = meeting?.multiMin || 1;
  const maxCards = meeting?.multiMax || 4;
  const canPick = canUseMeeting(game, meeting);
  const readyToSubmit =
    selectedCards.length >= minCards && selectedCards.length <= maxCards;

  useEffect(() => {
    setLocalSelectedCards(serverSelectedKey ? serverSelectedKey.split("|") : []);
  }, [meeting?.id, serverSelectedKey]);

  function toggleCard(card) {
    if (!canPick) return;

    const selected = selectedCardSet.has(card);
    const voteType = selected ? "unvote" : "vote";

    if (!selected && selectedCards.length >= maxCards) return;

    setLocalSelectedCards((currentCards) =>
      selected
        ? currentCards.filter((selectedCard) => selectedCard !== card)
        : [...currentCards, card]
    );

    game.socket.send(voteType, {
      meetingId: meeting.id,
      selection: card,
    });
  }

  return {
    canPick,
    maxCards,
    minCards,
    readyToSubmit,
    selectedCards,
    selectedCardSet,
    toggleCard,
  };
}

function CheatActions({ cheatMeetings, cardSelection }) {
  const game = useContext(GameContext);
  const { playCardsMeeting, submitMeeting, callLieMeeting } = cheatMeetings;

  if (game.stateViewing < 0) return null;

  return (
    <div className="cheat-actions">
      {playCardsMeeting && (
        <CheatSubmitActions
          submitMeeting={submitMeeting}
          cardSelection={cardSelection}
        />
      )}
      {callLieMeeting && <CheatChallengeActions meeting={callLieMeeting} />}
    </div>
  );
}

function CheatSubmitActions({ submitMeeting, cardSelection }) {
  const game = useContext(GameContext);
  const canSubmit = canUseMeeting(game, submitMeeting);

  function submitCards() {
    if (!canSubmit || !cardSelection.readyToSubmit) return;

    submitMeeting.votes[game.self] = "Yes";
    game.socket.send("vote", {
      meetingId: submitMeeting.id,
      selection: "Yes",
    });
  }

  return (
    <div className="cheat-submit-actions">
      <div className="cheat-selection-count">
        {cardSelection.selectedCards.length}/{cardSelection.maxCards}
      </div>
      {submitMeeting && (
        <button
          type="button"
          className="cheat-submit-button"
          disabled={!canSubmit || !cardSelection.readyToSubmit}
          onClick={submitCards}
          aria-label="Submit cards"
          title="Submit cards"
        >
          <CheckIcon fontSize="small" />
        </button>
      )}
    </div>
  );
}

function getCheatChallengeLabel(target) {
  if (target === "Don't Call Lie") return "Not Lie";
  if (target === "Call Lie") return "Lie";

  return target;
}

function CheatChallengeActions({ meeting }) {
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
    <div className="cheat-challenge-actions">
      {(meeting.targets || []).map((target) => (
        <button
          key={target}
          type="button"
          className={`cheat-challenge-button ${
            target === "Call Lie" ? "is-call" : "is-pass"
          } ${selectedAction === target ? "is-selected" : ""}`}
          disabled={!canAct}
          onClick={() => submitAction(target)}
        >
          {getCheatChallengeLabel(target)}
        </button>
      ))}
    </div>
  );
}

function CheatTable({ playCardsMeeting, cardSelection, actionContent }) {
  const game = useContext(GameContext);
  const state = getViewedState(game);

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="cheat-table-stage cheat-table-stage-pregame">
        <div className="cheat-table-felt">
          <div className="cheat-table-center">
            <div className="cheat-table-kicker">Cheat</div>
            <div className="cheat-table-title">Waiting for players</div>
            <div className="cheat-table-subtitle">
              The table opens once the first hand is dealt.
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
  const activePlayers = players.filter((player) => (player.CardsInHand || []).length > 0);

  return (
    <section
      className={`cheat-table-stage ${
        extraInfo.isTheFlyingDutchman ? "is-dutchman" : ""
      }`}
    >
      <div className="cheat-table-statusbar">
        <CheatMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
        <CheatMetric label="Required Rank" value={getRankPlural(extraInfo.RankNumber)} />
        <CheatMetric label="Stack" value={stack.length} />
        <CheatMetric label="Turn" value={currentTurnPlayer?.playerName || "-"} />
        <CheatMetric
          label="Players"
          value={`${activePlayers.length || players.length}/${players.length}`}
        />
      </div>

      <div className="cheat-table-felt">
        <div className="cheat-seat-rail cheat-seat-rail-top">
          {seatRails.top.map((player) => (
            <CheatSeat
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>

        <div className="cheat-table-center">
          <CheatStackSummary stack={stack} rankNumber={extraInfo.RankNumber} />
        </div>

        <div className="cheat-seat-rail cheat-seat-rail-bottom">
          {seatRails.bottom.map((player) => (
            <CheatSeat
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>
      </div>

        <div className="cheat-table-footer">
        <div className="cheat-hero-hand">
          <span>Your hand</span>
          <CheatCardLine
            cards={selfPlayer?.CardsInHand || []}
            meeting={playCardsMeeting}
            selection={cardSelection}
            revealed
            selectable
          />
        </div>
        {actionContent && (
          <div className="cheat-table-actions">{actionContent}</div>
        )}
      </div>
    </section>
  );
}

function CheatMetric({ label, value }) {
  return (
    <div className="cheat-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CheatStackSummary({ stack, rankNumber, compact = false }) {
  const visibleBacks = Math.min(stack.length || 1, compact ? 3 : 5);

  return (
    <div className={`cheat-stack-summary ${compact ? "is-compact" : ""}`}>
      <div className="cheat-stack-cards" aria-label="Stack">
        {Array.from({ length: visibleBacks }).map((_, index) => (
          <PlayingCard
            key={index}
            hidden={stack.length > 0}
            blank={stack.length === 0}
            className={`cheat-stack-card cheat-stack-card-${index}`}
          />
        ))}
      </div>
      <div className="cheat-stack-copy">
        <span>Current claim</span>
        <strong>{getRankPlural(rankNumber)}</strong>
        <em>{stack.length} cards in stack</em>
      </div>
    </div>
  );
}

function CheatCardLine({
  cards,
  revealed,
  small = false,
  selectable = false,
  meeting = null,
  selection = null,
}) {
  const values = Array.isArray(cards) ? cards : [];
  const targetSet = new Set(meeting?.targets || []);
  const canSelect = Boolean(selectable && meeting && selection?.canPick);

  if (values.length === 0) {
    return <div className="cheat-card-line is-empty">No cards</div>;
  }

  return (
    <div className={`cheat-card-line ${canSelect ? "is-selectable" : ""}`}>
      {values.map((card, index) => {
        const isSelectableCard = canSelect && targetSet.has(card);
        const isSelected = selection?.selectedCardSet?.has(card);

        if (!isSelectableCard) {
          return (
            <PlayingCard
              key={`${card}-${index}`}
              value={card}
              hidden={!revealed}
              className={small ? "cheat-playing-card-small" : ""}
            />
          );
        }

        return (
          <button
            key={`${card}-${index}`}
            type="button"
            className={`cheat-hand-card-button ${
              isSelected ? "is-selected" : ""
            } ${small ? "is-small" : ""}`}
            onClick={() => selection.toggleCard(card)}
          >
            <span className="cheat-card-button-frame">
              <PlayingCard
                value={card}
                hidden={!revealed}
                className={small ? "cheat-playing-card-small" : ""}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CheatSeat({ player, isCurrentPlayer, isTurn }) {
  const game = useContext(GameContext);
  const gamePlayer = game.players?.[player.playerId] || {};
  const displayName = getPlayerDisplayName(player, game.self);
  const cardCount = Array.isArray(player.CardsInHand)
    ? player.CardsInHand.length
    : 0;

  return (
    <button
      type="button"
      className={`cheat-seat ${isCurrentPlayer ? "is-self" : ""} ${
        isTurn ? "is-turn" : ""
      } ${cardCount === 0 ? "is-empty" : ""}`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="cheat-seat-avatar">
        <Avatar
          hasImage={gamePlayer.avatar}
          id={gamePlayer.userId || player.userId}
          name={player.playerName}
          mediumlarge
        />
      </span>
      <span className="cheat-seat-name" title={player.playerName}>
        {displayName}
      </span>
      <span className="cheat-seat-card-count">{cardCount} cards</span>
    </button>
  );
}

export function CheatRoundInfo() {
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
        <div className="cheat-info-panel">
          <CheatMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
          <CheatMetric label="Required Rank" value={getRankPlural(extraInfo.RankNumber)} />
          <CheatMetric label="Stack" value={stack.length} />
          <CheatMetric
            label="Action"
            value={currentTurnPlayer?.playerName || "-"}
          />
          <CheatStackSummary stack={stack} rankNumber={extraInfo.RankNumber} compact />
        </div>
      }
    />
  );
}

function CheatRoster() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);

  return (
    <SideMenu
      title="Seats"
      scrollable
      content={
        <div className="cheat-roster">
          {players.map((player) => (
            <CheatPlayerRow
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

function CheatPlayerRow({
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
      className={`cheat-player-row ${isCurrentPlayer ? "is-self" : ""} ${
        isSamePlayer ? "is-turn" : ""
      } ${safeCards.length === 0 ? "is-empty" : ""}`}
    >
      <button
        type="button"
        className="cheat-player-name"
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
      <div className="cheat-player-card-meta">
        <strong>{safeCards.length}</strong>
        <span>{safeCards.length === 1 ? "card" : "cards"}</span>
      </div>
      <CheatCardLine cards={safeCards} revealed={isCurrentPlayer} small />
    </div>
  );
}
