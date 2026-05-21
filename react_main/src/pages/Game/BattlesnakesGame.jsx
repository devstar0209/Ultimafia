import React, { useEffect, useContext, useState } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  PlayerList,
  OptionsList,
  Notes,
  SettingsMenu,
  MobileLayout,
  GameTypeContext,
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { battlesnakesAudioConfig } from "../../audio/audioConfigs";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameBattlesnakes.css";
import SnakeGameDisplay from "./SnakeGameDisplay";

export default function BattlesnakesGame() {
  const game = useContext(GameContext);

  const history = game.history;
  const stateViewing = game.stateViewing;
  const updateStateViewing = game.updateStateViewing;
  const loadAudioFiles = game.loadAudioFiles;
  const review = game.review;
  const self = game.self;
  const players = game.players;
  const [gameState, setGameState] = useState(null);

  // Make player view current state when it changes
  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    loadAudioFiles(battlesnakesAudioConfig);

    // Make game review start at the final state (shows the board)
    if (review) updateStateViewing({ type: "current" });
  }, [loadAudioFiles, review, updateStateViewing]);

  useSocketListeners((socket) => {
    socket.on("start", () => {
      game.playAudio("music/14_Minigame");
    });

    socket.on("winners", () => {
      game.stopAudio();
    });
  }, game.socket);

  const viewedState = getViewedState(game);
  const extraInfo = viewedState?.extraInfo;
  const boardState = review && extraInfo?.snakes ? extraInfo : gameState || extraInfo;
  const gameSocket = !review ? game.socket : undefined;
  const playerPanel = (
    <>
      {stateViewing < 0 && <PlayerList />}
      <BattlesnakesRoster gameState={boardState} />
    </>
  );
  const board = (
    <BattlesnakesArena
      players={players}
      self={self}
      gameSocket={gameSocket}
      extraInfo={extraInfo}
      gameState={boardState}
      onGameState={setGameState}
    />
  );
  const controls = <BattlesnakesControls gameSocket={gameSocket} />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="battlesnakes-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="battlesnakes-play-column">
              {board}
              <div className="battlesnakes-action-dock">{controls}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="battlesnakes-side-chat">
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
              <BattlesnakesRoundInfo gameState={boardState} />
              {controls}
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

function getSnakes(gameState) {
  return gameState?.snakes || {};
}

function getSnakeEntries(gameState) {
  return Object.entries(getSnakes(gameState));
}

function getActiveSegments(snake) {
  return Array.isArray(snake?.segments)
    ? snake.segments.filter((segment) => segment.active !== false)
    : [];
}

function getPlayerDisplayName(playerId, players, self) {
  const player = players?.[playerId];

  if (playerId === self) return "You";

  return player?.name || "Unknown";
}

function getAliveSnakeCount(gameState) {
  return getSnakeEntries(gameState).filter(([, snake]) => snake.alive).length;
}

function getLongestSnake(gameState, players, self) {
  return getSnakeEntries(gameState).reduce(
    (longest, [playerId, snake]) => {
      const length = getActiveSegments(snake).length;

      if (length <= longest.length) return longest;

      return {
        length,
        name: getPlayerDisplayName(playerId, players, self),
      };
    },
    { length: 0, name: "-" }
  );
}

function sendDirection(gameSocket, direction) {
  if (!gameSocket) return;

  gameSocket.send("move", direction);
}

function BattlesnakesArena({
  players,
  self,
  gameSocket,
  extraInfo,
  gameState,
  onGameState,
}) {
  const game = useContext(GameContext);
  const snakeEntries = getSnakeEntries(gameState);
  const foods = Array.isArray(gameState?.foods) ? gameState.foods : [];
  const selfSnake = gameState?.snakes?.[self];
  const longestSnake = getLongestSnake(gameState, players, self);

  if (game.stateViewing < 0) {
    return (
      <section className="battlesnakes-board battlesnakes-board-pregame">
        <div className="battlesnakes-stage">
          <div className="battlesnakes-board-center">
            <div className="battlesnakes-board-kicker">Battlesnakes</div>
            <div className="battlesnakes-board-title">Waiting for players</div>
            <div className="battlesnakes-board-subtitle">
              The arena opens once the first snakes are released.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="battlesnakes-board">
      <div className="battlesnakes-statusbar">
        <BattlesnakesMetric
          label="Alive"
          value={`${getAliveSnakeCount(gameState)}/${snakeEntries.length || "-"}`}
        />
        <BattlesnakesMetric label="Board" value={gameState?.gridSize || "-"} />
        <BattlesnakesMetric label="Food" value={foods.length} />
        <BattlesnakesMetric
          label="Your Length"
          value={selfSnake ? getActiveSegments(selfSnake).length : "-"}
        />
        <BattlesnakesMetric
          label="Longest"
          value={
            longestSnake.length
              ? `${longestSnake.name} (${longestSnake.length})`
              : "-"
          }
        />
      </div>

      <div className="battlesnakes-stage">
        {players ? (
          <SnakeGameDisplay
            player={self}
            players={players}
            gameSocket={gameSocket}
            extraInfo={extraInfo}
            onGameState={onGameState}
          />
        ) : (
          <div className="battlesnakes-board-center">
            <div className="battlesnakes-board-title">Loading arena</div>
          </div>
        )}
      </div>
    </section>
  );
}

function BattlesnakesMetric({ label, value }) {
  return (
    <div className="battlesnakes-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function BattlesnakesControls({ gameSocket }) {
  return (
    <SideMenu
      title="Controls"
      content={
        <div className="battlesnakes-controls" aria-label="Move snake">
          <button
            type="button"
            className="battlesnakes-control-button battlesnakes-control-up"
            disabled={!gameSocket}
            onClick={() => sendDirection(gameSocket, "up")}
            aria-label="Move up"
            title="Move up"
          >
            <i className="fas fa-arrow-up" />
          </button>
          <button
            type="button"
            className="battlesnakes-control-button battlesnakes-control-left"
            disabled={!gameSocket}
            onClick={() => sendDirection(gameSocket, "left")}
            aria-label="Move left"
            title="Move left"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <button
            type="button"
            className="battlesnakes-control-button battlesnakes-control-down"
            disabled={!gameSocket}
            onClick={() => sendDirection(gameSocket, "down")}
            aria-label="Move down"
            title="Move down"
          >
            <i className="fas fa-arrow-down" />
          </button>
          <button
            type="button"
            className="battlesnakes-control-button battlesnakes-control-right"
            disabled={!gameSocket}
            onClick={() => sendDirection(gameSocket, "right")}
            aria-label="Move right"
            title="Move right"
          >
            <i className="fas fa-arrow-right" />
          </button>
        </div>
      }
    />
  );
}

function BattlesnakesRoundInfo({ gameState }) {
  if (!gameState?.snakes) return <></>;

  const snakeEntries = getSnakeEntries(gameState);
  const foods = Array.isArray(gameState.foods) ? gameState.foods : [];

  return (
    <SideMenu
      title="Arena"
      scrollable
      content={
        <div className="battlesnakes-info-panel">
          <BattlesnakesMetric
            label="Alive"
            value={`${getAliveSnakeCount(gameState)}/${snakeEntries.length}`}
          />
          <BattlesnakesMetric label="Food" value={foods.length} />
          <BattlesnakesMetric label="Board Size" value={gameState.gridSize || "-"} />
        </div>
      }
    />
  );
}

function BattlesnakesRoster({ gameState }) {
  const game = useContext(GameContext);
  const snakeEntries = getSnakeEntries(gameState);

  if (game.stateViewing < 0 || snakeEntries.length === 0) {
    return game.stateViewing < 0 ? null : <PlayerList />;
  }

  return (
    <SideMenu
      title="Snakes"
      scrollable
      content={
        <div className="battlesnakes-roster">
          {snakeEntries.map(([playerId, snake]) => (
            <BattlesnakesPlayerRow
              key={playerId}
              playerId={playerId}
              snake={snake}
              isCurrentPlayer={playerId === game.self}
            />
          ))}
        </div>
      }
    />
  );
}

function BattlesnakesPlayerRow({ playerId, snake, isCurrentPlayer }) {
  const game = useContext(GameContext);
  const player = game.players?.[playerId] || {};
  const displayName = isCurrentPlayer ? "You" : player.name || "Unknown";
  const segmentCount = getActiveSegments(snake).length;

  return (
    <button
      type="button"
      className={`battlesnakes-player-row ${
        isCurrentPlayer ? "is-self" : ""
      } ${snake.alive ? "is-alive" : "is-dead"}`}
      onClick={() => player.userId && window.open(`/user/${player.userId}`, "_blank")}
    >
      <span
        className="battlesnakes-player-color"
        style={{
          backgroundColor: player.textColor || "#8ad66d",
          color: player.textColor || "#8ad66d",
        }}
      />
      <Avatar
        hasImage={player.avatar}
        id={player.userId}
        name={player.name || displayName}
        mediumlarge
      />
      <span className="battlesnakes-player-name" title={player.name || displayName}>
        {displayName}
      </span>
      <span className="battlesnakes-player-meta">
        <strong>{segmentCount}</strong>
        <em>{snake.alive ? snake.direction || "alive" : "out"}</em>
      </span>
    </button>
  );
}
