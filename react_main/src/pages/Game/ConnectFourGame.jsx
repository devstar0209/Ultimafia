import React, { useRef, useEffect, useContext, useState } from "react";

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
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameConnectFour.css";

export default function ConnectFourGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const stateViewing = game.stateViewing;
  const updateStateViewing = game.updateStateViewing;
  const review = game.review;

  const playBellRef = useRef(false);

  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    if (review) updateStateViewing({ type: "current" });
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
      {stateViewing < 0 && <PlayerList />}
      <ConnectFourRoster />
    </>
  );
  const board = <ConnectFourTable />;
  const actionList = <ConnectFourActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="connect-four-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="connect-four-play-column">
              {board}
              <div className="connect-four-action-dock">{actionList}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="connect-four-side-chat">
                <TextMeetingLayout />
              </div>
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={board}
          innerRightContent={
            <>
              <OptionsList />
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

function getBoard(game) {
  const board = getExtraInfo(game).board;

  return Array.isArray(board) ? board : [];
}

function getBoardDimensions(board) {
  return {
    rows: board.length,
    columns: Math.max(0, ...board.map((row) => row.length)),
  };
}

function getMoveCount(board) {
  return board.flat().filter((cell) => cell !== " ").length;
}

function getPlayerByName(players, name) {
  return Object.values(players || {}).find((player) => player.name === name);
}

function getPlayerName(player, self) {
  if (!player) return "Unknown";
  return player.id === self ? "You" : player.name;
}

function getColumnMeeting(game) {
  const state = getViewedState(game);
  const meetings = state?.meetings || {};

  if (game.stateViewing !== game.history.currentState) return null;

  return Object.values(meetings).find(
    (meeting) =>
      meeting.actionName === "Choose Column" &&
      meeting.voting &&
      meeting.amMember &&
      meeting.canVote
  );
}

function sendColumnVote(game, meeting, colIndex) {
  if (!meeting) return;

  const selection = String(colIndex + 1);
  const isUnvote = meeting.votes?.[game.self] === selection;

  game.socket.send(isUnvote ? "unvote" : "vote", {
    meetingId: meeting.id,
    selection,
  });
}

function ConnectFourActions() {
  return (
    <ActionList
      meetingFilter={(meeting) => meeting.actionName !== "Choose Column"}
      hideIfEmpty
    />
  );
}

function ConnectFourTable() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const extraInfo = state?.extraInfo || {};
  const board = Array.isArray(extraInfo.board) ? extraInfo.board : [];
  const dimensions = getBoardDimensions(board);
  const columnMeeting = getColumnMeeting(game);
  const canDrop = Boolean(columnMeeting);
  const currentPlayer = extraInfo.currentPlayerId
    ? game.players?.[extraInfo.currentPlayerId]
    : getPlayerByName(game.players, extraInfo.currentPlayerName);
  const currentPlayerName = currentPlayer
    ? getPlayerName(currentPlayer, game.self)
    : extraInfo.currentPlayerName || "-";

  if (game.stateViewing < 0 || !state || board.length === 0) {
    return (
      <section className="connect-four-stage connect-four-stage-pregame">
        <div className="connect-four-machine">
          <div className="connect-four-board-center">
            <div className="connect-four-board-kicker">Connect Four</div>
            <div className="connect-four-board-title">Waiting for players</div>
            <div className="connect-four-board-subtitle">
              The board will open once the first turn starts.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="connect-four-stage">
      <div className="connect-four-statusbar">
        <ConnectFourMetric label="Turn" value={currentPlayerName} />
        <ConnectFourMetric
          label="Board"
          value={`${dimensions.columns} x ${dimensions.rows}`}
        />
        <ConnectFourMetric label="Moves" value={getMoveCount(board)} />
        <ConnectFourMetric
          label="Action"
          value={canDrop ? "Choose a column" : "Watching"}
        />
      </div>

      <div className="connect-four-machine">
        <ConnectFourBoard
          rows={board}
          players={game.players}
          self={game.self}
          onColumnClick={
            canDrop
              ? (colIndex) => sendColumnVote(game, columnMeeting, colIndex)
              : null
          }
          selectedColumn={
            columnMeeting?.votes?.[game.self]
              ? Number(columnMeeting.votes[game.self]) - 1
              : null
          }
          winningLine={extraInfo.winningLine}
        />
      </div>
    </section>
  );
}

function ConnectFourMetric({ label, value }) {
  return (
    <div className="connect-four-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function ConnectFourBoard({
  rows,
  players,
  self,
  onColumnClick,
  selectedColumn,
  winningLine,
}) {
  const [hoveredCol, setHoveredCol] = useState(null);
  const winningCells = new Set();

  if (winningLine) {
    for (const [row, column] of winningLine) {
      winningCells.add(`${row},${column}`);
    }
  }

  return (
    <div className="connect-four-board-wrap">
      <div
        className="connect-four-column-hints"
        aria-hidden="true"
        style={{ gridTemplateColumns: `repeat(${rows[0]?.length || 1}, 1fr)` }}
      >
        {(rows[0] || []).map((_, colIndex) => (
          <span
            key={colIndex}
            className={`connect-four-column-hint ${
              hoveredCol === colIndex ? "is-hovered" : ""
            } ${selectedColumn === colIndex ? "is-selected" : ""}`}
          >
            <i className="fas fa-chevron-down" />
          </span>
        ))}
      </div>
      <div
        className="connect-four-board"
        onMouseLeave={() => setHoveredCol(null)}
      >
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="connect-four-board-row">
            {row.map((cell, colIndex) => (
              <BoardCell
                key={`${rowIndex}-${colIndex}`}
                cell={cell}
                player={getPlayerByName(players, cell)}
                self={self}
                clickable={Boolean(onColumnClick)}
                highlighted={hoveredCol === colIndex}
                selected={selectedColumn === colIndex}
                winning={winningCells.has(`${rowIndex},${colIndex}`)}
                onClick={onColumnClick ? () => onColumnClick(colIndex) : undefined}
                onMouseEnter={
                  onColumnClick ? () => setHoveredCol(colIndex) : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardCell({
  cell,
  player,
  self,
  clickable,
  highlighted,
  selected,
  winning,
  onClick,
  onMouseEnter,
}) {
  const classNames = ["connect-four-cell"];

  if (clickable) classNames.push("is-clickable");
  if (highlighted) classNames.push("is-highlighted");
  if (selected) classNames.push("is-selected");
  if (winning) classNames.push("is-winning");
  if (player?.id === self) classNames.push("is-self");

  return (
    <button
      type="button"
      className={classNames.join(" ")}
      disabled={!clickable}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={
        player
          ? `${player.name} chip`
          : cell === " "
            ? "Empty slot"
            : `${cell} chip`
      }
    >
      <span className="connect-four-slot">
        {player && <PlayerAvatar player={player} />}
      </span>
    </button>
  );
}

function ConnectFourRoster() {
  const game = useContext(GameContext);
  const board = getBoard(game);

  if (game.stateViewing < 0 || board.length === 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const chipCounts = board.flat().reduce((counts, cell) => {
    if (cell !== " ") counts[cell] = (counts[cell] || 0) + 1;
    return counts;
  }, {});

  return (
    <SideMenu
      title="Players"
      scrollable
      content={
        <div className="connect-four-roster">
          {Object.values(game.players || {}).map((player) => (
            <ConnectFourPlayerRow
              key={player.id}
              player={player}
              chipCount={chipCounts[player.name] || 0}
              isCurrentPlayer={player.id === extraInfo.currentPlayerId}
              isSelf={player.id === game.self}
            />
          ))}
        </div>
      }
    />
  );
}

function ConnectFourPlayerRow({ player, chipCount, isCurrentPlayer, isSelf }) {
  return (
    <button
      type="button"
      className={`connect-four-player-row ${isCurrentPlayer ? "is-turn" : ""} ${
        isSelf ? "is-self" : ""
      }`}
      onClick={() =>
        player.userId && window.open(`/user/${player.userId}`, "_blank")
      }
    >
      <span className="connect-four-player-avatar">
        <PlayerAvatar player={player} />
      </span>
      <span className="connect-four-player-name" title={player.name}>
        {isSelf ? "You" : player.name}
      </span>
      <span className="connect-four-player-meta">
        <strong>{chipCount}</strong>
        <em>{isCurrentPlayer ? "turn" : "chips"}</em>
      </span>
    </button>
  );
}

function PlayerAvatar({ player }) {
  let avatarId = player.userId;

  if (player.anonId != null) {
    avatarId = player.anonId;
  }

  return (
    <Avatar
      id={player.userId}
      avatarId={avatarId}
      hasImage={player.avatar}
      name={player.name}
      mediumlarge
      ConnectFour
    />
  );
}
