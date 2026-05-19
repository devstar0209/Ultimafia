import React, { useRef, useEffect, useContext } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  ActionList,
  PlayerList,
  OptionsList,
  Notes,
  SettingsMenu,
  MobileLayout,
  GameTypeContext,
} from "./Game";
import { GameContext } from "../../Contexts";
import { cardGameAudioConfig } from "../../audio/audioConfigs";
import { SideMenu } from "./Game";

import "css/game.css";
import "css/gameCardGames.css";

export default function TexasHoldEmGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const updateStateViewing = game.updateStateViewing;
  const stateViewing = game.stateViewing;
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
      <TexasTableRoster />
    </>
  );

  const actionList = <TexasBettingActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="texas-holdem-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerList}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="texas-play-column">
              <TexasTable />
              <div className="texas-chat-dock">
                <TextMeetingLayout />
              </div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <ThePot />
              {actionList}
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerList}
          additionalInfoContent={<TexasTable />}
          innerRightContent={
            <>
              <OptionsList />
              <ThePot />
              {actionList}
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

function formatChipCount(value) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed)) return "0";

  return parsed.toLocaleString();
}

function getPlayers(extraInfo) {
  return Array.isArray(extraInfo.randomizedPlayers)
    ? extraInfo.randomizedPlayers
    : [];
}

function getCurrentTurnPlayer(players, extraInfo) {
  return players.find((player) => player.userId === extraInfo.whoseTurnIsIt);
}

function getBettingMeetings(game) {
  const state = getViewedState(game);
  const meetings = state?.meetings || {};
  const meetingList = Object.values(meetings);

  return {
    moveMeeting: meetingList.find(
      (meeting) =>
        meeting.name === "Move" || meeting.actionName === "Choose an Action?"
    ),
    raiseMeeting: meetingList.find(
      (meeting) => meeting.name === "Raise" || meeting.actionName === "Bet"
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
      className={`card texas-playing-card ${cardClass} ${className}`}
      aria-label={blank ? "Empty card slot" : hidden ? "Hidden card" : value}
    />
  );
}

function TexasBettingActions() {
  const game = useContext(GameContext);
  const { moveMeeting, raiseMeeting } = getBettingMeetings(game);
  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);
  const selfPlayer = players.find((player) => player.playerId === game.self);
  const largestBet = Math.max(
    0,
    ...players.map((player) => Number(player.Bets || 0))
  );
  const callAmount = Math.max(
    0,
    largestBet - Number(selfPlayer?.Bets || 0)
  );
  const hasBettingActions = moveMeeting || raiseMeeting;

  if (!hasBettingActions) return null;

  return (
    <>
      {moveMeeting && (
        <TexasMoveActions
          meeting={moveMeeting}
          canAct={canUseMeeting(game, moveMeeting)}
          callAmount={callAmount}
          socket={game.socket}
          self={game.self}
        />
      )}
      <ActionList
        title="Bet / Raise"
        meetingFilter={(meeting) => meeting.id === raiseMeeting?.id}
        actionStyle={{
          color: extraInfo?.isTheFlyingDutchman ? "#718E77" : undefined,
        }}
        hideIfEmpty
      />
    </>
  );
}

function TexasMoveActions({ meeting, canAct, callAmount, socket, self }) {
  const selectedAction = meeting.votes?.[self];
  const targets = Array.isArray(meeting.targets) ? meeting.targets : [];

  function submitAction(target) {
    if (!canAct) return;

    socket.send("vote", {
      meetingId: meeting.id,
      selection: target,
    });
  }

  return (
    <SideMenu
      title="Action"
      content={
        <div className="texas-direct-actions">
          <div className="texas-direct-action-grid">
            {targets.map((target) => (
              <button
                key={target}
                type="button"
                className={`texas-action-button texas-action-${target
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")} ${
                  selectedAction === target ? "is-selected" : ""
                }`}
                disabled={!canAct}
                onClick={() => submitAction(target)}
              >
                <span>{getActionLabel(target, callAmount)}</span>
                {target === "Call" && callAmount > 0 && (
                  <strong>{formatChipCount(callAmount)}</strong>
                )}
              </button>
            ))}
          </div>
          {selectedAction && (
            <div className="texas-action-submitted">
              Selected {getActionLabel(selectedAction, callAmount)}
            </div>
          )}
        </div>
      }
    />
  );
}

function getActionLabel(action, callAmount) {
  if (action === "Call" && callAmount === 0) return "Call";
  return action;
}

function TexasTable() {
  const game = useContext(GameContext);
  const state = getViewedState(game);

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="texas-table-stage texas-table-stage-pregame">
        <div className="texas-table-felt">
          <div className="texas-table-center">
            <div className="texas-table-kicker">Texas Hold Em</div>
            <div className="texas-table-title">Waiting for another player</div>
            <div className="texas-table-subtitle">
              The table will open once enough players are seated.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const extraInfo = state.extraInfo || {};
  const players = getPlayers(extraInfo);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);
  const communityCards = Array.isArray(extraInfo.CommunityCards)
    ? extraInfo.CommunityCards
    : [];
  const visibleCards = [...communityCards];

  while (visibleCards.length < 5) {
    visibleCards.push(null);
  }

  const activePlayers = players.filter((player) => !player.Folded);
  const totalChips = players.reduce(
    (sum, player) => sum + Number(player.Chips || 0),
    0
  );
  const largestBet = Math.max(0, ...players.map((player) => Number(player.Bets || 0)));
  const selfPlayer = players.find((player) => player.playerId === game.self);

  return (
    <section className="texas-table-stage">
      <div className="texas-table-statusbar">
        <TexasMetric label="Phase" value={extraInfo.Phase || state.name} />
        <TexasMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
        <TexasMetric label="Pot" value={formatChipCount(extraInfo.ThePot)} />
        <TexasMetric label="To Call" value={formatChipCount(largestBet)} />
      </div>

      <div className="texas-table-felt">
        <div className="texas-seat-rail texas-seat-rail-top">
          {players.slice(0, Math.ceil(players.length / 2)).map((player) => (
            <TexasSeatChip
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>

        <div className="texas-table-center">
          <div className="texas-pot-stack">
            <span className="texas-pot-label">Pot</span>
            <strong>{formatChipCount(extraInfo.ThePot)}</strong>
          </div>
          <div className="texas-community-board" aria-label="Community cards">
            {visibleCards.map((card, index) => (
              <PlayingCard
                key={`${card || "blank"}-${index}`}
                value={card}
                blank={!card}
                className={card ? "is-dealt" : ""}
              />
            ))}
          </div>
          <div className="texas-turn-line">
            {currentTurnPlayer
              ? `${currentTurnPlayer.playerName} is on action`
              : "Waiting for the next action"}
          </div>
        </div>

        <div className="texas-seat-rail texas-seat-rail-bottom">
          {players.slice(Math.ceil(players.length / 2)).map((player) => (
            <TexasSeatChip
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>
      </div>

      <div className="texas-table-footer">
        <div className="texas-hero-hand">
          <span>Your hand</span>
          <div className="texas-hand-cards">
            {(selfPlayer?.CardsInHand || [null, null]).map((card, index) => (
              <PlayingCard
                key={`${card || "self-hidden"}-${index}`}
                value={card}
                hidden={!card}
              />
            ))}
          </div>
        </div>
        <div className="texas-table-quickstats">
          <TexasMetric label="Active" value={`${activePlayers.length}/${players.length}`} />
          <TexasMetric label="Table Chips" value={formatChipCount(totalChips)} />
        </div>
      </div>
    </section>
  );
}

function TexasMetric({ label, value }) {
  return (
    <div className="texas-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TexasSeatChip({ player, isCurrentPlayer, isTurn }) {
  return (
    <button
      type="button"
      className={`texas-seat-chip ${isCurrentPlayer ? "is-self" : ""} ${
        isTurn ? "is-turn" : ""
      } ${player.Folded ? "is-folded" : ""}`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="texas-seat-name">{player.playerName}</span>
      <span className="texas-seat-stack">{formatChipCount(player.Chips)}</span>
    </button>
  );
}

export function ThePot() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);
  const activePlayers = players.filter((player) => !player.Folded);

  return (
    <SideMenu
      title="Table Info"
      scrollable
      content={
        <div className="texas-info-panel">
          <TexasMetric label="Phase" value={extraInfo.Phase || "-"} />
          <TexasMetric label="Round" value={extraInfo.RoundNumber ?? "-"} />
          <TexasMetric label="Pot" value={formatChipCount(extraInfo.ThePot)} />
          <TexasMetric
            label="Action"
            value={currentTurnPlayer?.playerName || "-"}
          />
          <TexasMetric
            label="Active Players"
            value={`${activePlayers.length}/${players.length}`}
          />
          <CommunityCards />
        </div>
      }
    />
  );
}

function CommunityCards() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const communityCards = Array.isArray(extraInfo.CommunityCards)
    ? extraInfo.CommunityCards
    : [];

  return (
    <div className="texas-info-board">
      <span>Community</span>
      <div className="texas-info-cards">
        {communityCards.length > 0 ? (
          communityCards.map((value, index) => (
            <PlayingCard key={`${value}-${index}`} value={value} />
          ))
        ) : (
          <span className="texas-muted">No board cards yet</span>
        )}
      </div>
    </div>
  );
}

function TexasTableRoster() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);

  return (
    <SideMenu
      title="Seats"
      scrollable
      content={
        <div className="texas-roster">
          {players.map((player) => (
            <TexasPlayerRow
              key={player.userId || player.playerName}
              userId={player.userId}
              playerName={player.playerName}
              CardsInHand={player.CardsInHand}
              Chips={player.Chips}
              Bets={player.Bets}
              isCurrentPlayer={player.playerId === game.self}
              isTheFlyingDutchman={extraInfo.isTheFlyingDutchman}
              whoseTurnIsIt={extraInfo.whoseTurnIsIt}
              Folded={player.Folded}
            />
          ))}
        </div>
      }
    />
  );
}

function TexasPlayerRow({
  userId,
  playerName,
  CardsInHand,
  Chips,
  Bets,
  isCurrentPlayer,
  isTheFlyingDutchman,
  whoseTurnIsIt,
  Folded,
}) {
  Chips = Chips || 0;
  Bets = Bets || 0;
  const isSamePlayer = whoseTurnIsIt === userId;

  return (
    <div
      className={`texas-player-row ${isCurrentPlayer ? "is-self" : ""} ${
        isSamePlayer ? "is-turn" : ""
      } ${Folded ? "is-folded" : ""}`}
    >
      <button
        type="button"
        className="texas-player-name"
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
      <div className="texas-player-cards">
        {(CardsInHand || []).length > 0 ? (
          (CardsInHand || []).map((value, index) => (
            <PlayingCard
              key={`${value}-${index}`}
              value={value}
              hidden={!isCurrentPlayer}
            />
          ))
        ) : (
          <>
            <PlayingCard hidden />
            <PlayingCard hidden />
          </>
        )}
      </div>
      <div className="texas-player-ledger">
        <span>{formatChipCount(Chips)} chips</span>
        {Bets > 0 && <strong>{formatChipCount(Bets)} bet</strong>}
        {Folded && <em>Folded</em>}
      </div>
    </div>
  );
}
