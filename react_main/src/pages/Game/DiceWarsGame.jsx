import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  PlayerList,
  OptionsList,
  Notes,
  SettingsMenu,
  GameTypeContext,
  SideMenu,
  MobileLayout,
} from "./Game";
import { GameContext } from "../../Contexts";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameDiceWars.css";

const HEX_SIZE = 25;

export default function DiceWarsGame() {
  const game = useContext(GameContext);
  const { history, stateViewing, updateStateViewing, self, players } = game;
  const [liveGameState, setLiveGameState] = useState(null);
  const [turnTimer, setTurnTimer] = useState(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    if (game.review) updateStateViewing({ type: "first" });
  }, [game.review, updateStateViewing]);

  useSocketListeners((socket) => {
    socket.on("gameState", (state) => {
      setLiveGameState(state);
    });

    socket.on("timerInfo", (info) => {
      if (info?.name !== "main") return;

      setTurnTimer({
        delay: info.delay,
        time: 0,
        lastSyncTime: 0,
        lastSyncTimestamp: Date.now(),
        hiddenUntil: Date.now() + 250,
      });
    });

    socket.on("clearTimer", (name) => {
      if (name === "main") setTurnTimer(null);
    });

    socket.on("time", (info) => {
      if (info?.name !== "main") return;

      setTurnTimer((current) => {
        if (!current?.delay) return current;

        return {
          ...current,
          time: info.time,
          lastSyncTime: info.time,
          lastSyncTimestamp: Date.now(),
        };
      });
    });
  }, game.socket);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTurnTimer((current) => {
        if (!current?.delay || current.lastSyncTimestamp == null) {
          return current;
        }

        return {
          ...current,
          time: current.lastSyncTime + Date.now() - current.lastSyncTimestamp,
          now: Date.now(),
        };
      });
    }, 200);

    return () => clearInterval(timerInterval);
  }, []);

  const historyGameState = history.states?.[stateViewing]?.extraInfo;
  const isViewingLiveState =
    !game.review && stateViewing === history.currentState;
  const gameState =
    isViewingLiveState && liveGameState?.territories
      ? liveGameState
      : historyGameState?.territories
      ? historyGameState
      : liveGameState;

  const playerList = (
    <>
      {stateViewing < 0 && <PlayerList />}
      <DiceWarsRoster gameState={gameState} />
    </>
  );

  const renderBoard = () =>
    players &&
    game.socket && (
      <DiceWarsBoardWrapper
        player={self}
        players={players}
        gameSocket={game.socket}
        gameState={gameState}
        turnTimer={turnTimer}
        isReview={game.review}
        selectedTerritoryId={selectedTerritoryId}
        setSelectedTerritoryId={setSelectedTerritoryId}
      />
    );

  return (
    <GameTypeContext.Provider
      value={{
        singleState: false,
      }}
    >
      <div className="dice-wars-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerList}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="dice-wars-play-column">{renderBoard()}</div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="dice-wars-side-chat">
                <TextMeetingLayout combineMessagesFromAllMeetings />
              </div>
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerList}
          additionalInfoContent={renderBoard()}
          innerRightContent={<OptionsList />}
        />
      </div>
    </GameTypeContext.Provider>
  );
}

function hexToPixel(col, row) {
  return {
    x: HEX_SIZE * (3 / 2) * col,
    y: HEX_SIZE * Math.sqrt(3) * (row + 0.5 * (col % 2)),
  };
}

function getHexPath(centerX, centerY) {
  const points = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = centerX + HEX_SIZE * Math.cos(angle);
    const y = centerY + HEX_SIZE * Math.sin(angle);
    points.push([x, y]);
  }

  return (
    points
      .map((point, index) =>
        index === 0 ? `M${point[0]},${point[1]}` : `L${point[0]},${point[1]}`
      )
      .join(" ") + "Z"
  );
}

function getHexCorners(centerX, centerY) {
  const corners = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push({
      x: centerX + HEX_SIZE * Math.cos(angle),
      y: centerY + HEX_SIZE * Math.sin(angle),
    });
  }

  return corners;
}

function buildTerritoryPath(territoryId, hexGrid, offsetX, offsetY) {
  const territoryHexes = hexGrid.filter(
    (hex) => hex.territoryId === territoryId && !hex.isOcean
  );

  if (territoryHexes.length === 0) return null;

  if (territoryHexes.length === 1) {
    const hex = territoryHexes[0];
    const position = hexToPixel(hex.col, hex.row);
    return getHexPath(position.x + offsetX, position.y + offsetY);
  }

  const edges = new Map();

  territoryHexes.forEach((hex) => {
    const position = hexToPixel(hex.col, hex.row);
    const corners = getHexCorners(position.x + offsetX, position.y + offsetY);

    for (let i = 0; i < 6; i++) {
      const pointA = corners[i];
      const pointB = corners[(i + 1) % 6];
      const edgeKey =
        pointA.x < pointB.x || (pointA.x === pointB.x && pointA.y < pointB.y)
          ? `${pointA.x.toFixed(2)},${pointA.y.toFixed(2)},${pointB.x.toFixed(
              2
            )},${pointB.y.toFixed(2)}`
          : `${pointB.x.toFixed(2)},${pointB.y.toFixed(2)},${pointA.x.toFixed(
              2
            )},${pointA.y.toFixed(2)}`;

      edges.set(edgeKey, (edges.get(edgeKey) || 0) + 1);
    }
  });

  const perimeterEdges = [];

  edges.forEach((count, key) => {
    if (count === 1) {
      const [x1, y1, x2, y2] = key.split(",").map(Number);
      perimeterEdges.push({ x1, y1, x2, y2 });
    }
  });

  if (perimeterEdges.length === 0) return null;

  const path = [];
  const usedEdges = new Set();
  let currentEdge = perimeterEdges[0];

  path.push({ x: currentEdge.x1, y: currentEdge.y1 });
  path.push({ x: currentEdge.x2, y: currentEdge.y2 });
  usedEdges.add(0);

  let currentPoint = { x: currentEdge.x2, y: currentEdge.y2 };

  while (usedEdges.size < perimeterEdges.length) {
    let foundNext = false;

    for (let i = 0; i < perimeterEdges.length; i++) {
      if (usedEdges.has(i)) continue;

      const edge = perimeterEdges[i];
      const distanceA =
        Math.abs(edge.x1 - currentPoint.x) +
        Math.abs(edge.y1 - currentPoint.y);
      const distanceB =
        Math.abs(edge.x2 - currentPoint.x) +
        Math.abs(edge.y2 - currentPoint.y);

      if (distanceA < 0.1) {
        currentPoint = { x: edge.x2, y: edge.y2 };
        path.push(currentPoint);
        usedEdges.add(i);
        foundNext = true;
        break;
      }

      if (distanceB < 0.1) {
        currentPoint = { x: edge.x1, y: edge.y1 };
        path.push(currentPoint);
        usedEdges.add(i);
        foundNext = true;
        break;
      }
    }

    if (!foundNext) break;
  }

  if (path.length < 3) return null;

  return (
    path
      .map((point, index) =>
        index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`
      )
      .join(" ") + "Z"
  );
}

function getPlayerName(players, playerId) {
  return players?.[playerId]?.name || "Unknown";
}

function getTerritoryCounts(gameState) {
  return (gameState?.territories || []).reduce((counts, territory) => {
    if (territory.playerId) {
      counts[territory.playerId] = (counts[territory.playerId] || 0) + 1;
    }

    return counts;
  }, {});
}

function getDiceCounts(gameState) {
  return (gameState?.territories || []).reduce((counts, territory) => {
    if (territory.playerId) {
      counts[territory.playerId] =
        (counts[territory.playerId] || 0) + Number(territory.dice || 0);
    }

    return counts;
  }, {});
}

function getPlayerIds(gameState, players) {
  if (Array.isArray(gameState?.turnOrder) && gameState.turnOrder.length > 0) {
    return gameState.turnOrder;
  }

  const ids = new Set();

  (gameState?.territories || []).forEach((territory) => {
    if (territory.playerId) ids.add(territory.playerId);
  });

  Object.keys(players || {}).forEach((playerId) => ids.add(playerId));

  return [...ids];
}

function getSelectedTerritory(gameState, selectedTerritoryId) {
  if (selectedTerritoryId == null) return null;

  return gameState?.territories?.find(
    (territory) => territory.id === selectedTerritoryId
  );
}

function DiceWarsBoardWrapper({
  player,
  players,
  gameSocket,
  gameState,
  turnTimer,
  isReview,
  selectedTerritoryId,
  setSelectedTerritoryId,
}) {
  const [showIntro, setShowIntro] = useState(true);
  const svgRef = useRef();
  const playerId = player || null;
  const territoryCounts = useMemo(
    () => getTerritoryCounts(gameState),
    [gameState]
  );
  const diceCounts = useMemo(() => getDiceCounts(gameState), [gameState]);
  const selectedTerritory = getSelectedTerritory(gameState, selectedTerritoryId);
  const playerIds = getPlayerIds(gameState, players);
  const currentTurnName = getPlayerName(players, gameState?.currentTurnPlayerId);

  const handleHexClick = useCallback(
    (hex) => {
      if (isReview || !gameState) return;
      if (hex.isOcean || hex.territoryId === null) return;

      const territory = gameState.territories.find(
        (item) => item.id === hex.territoryId
      );

      if (!territory || gameState.currentTurnPlayerId !== playerId) return;

      if (selectedTerritoryId == null) {
        if (territory.playerId === playerId && territory.dice >= 2) {
          setSelectedTerritoryId(territory.id);
        }

        return;
      }

      if (selectedTerritoryId === territory.id) {
        setSelectedTerritoryId(null);
        return;
      }

      const fromTerritory = gameState.territories.find(
        (item) => item.id === selectedTerritoryId
      );

      if (
        fromTerritory &&
        fromTerritory.neighbors.includes(territory.id) &&
        territory.playerId !== playerId
      ) {
        gameSocket.send("attack", {
          fromId: selectedTerritoryId,
          toId: territory.id,
        });
        setSelectedTerritoryId(null);
      } else if (territory.playerId === playerId && territory.dice >= 2) {
        setSelectedTerritoryId(territory.id);
      } else {
        setSelectedTerritoryId(null);
      }
    },
    [
      gameSocket,
      gameState,
      isReview,
      playerId,
      selectedTerritoryId,
      setSelectedTerritoryId,
    ]
  );

  useEffect(() => {
    if (!gameState?.hexGrid || !gameState?.territories) return;

    const hexGrid = gameState.hexGrid;
    const territories = gameState.territories;
    const playerColors = gameState.playerColors || {};
    const territoryMap = {};

    territories.forEach((territory) => {
      territoryMap[territory.id] = territory;
    });

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    hexGrid.forEach((hex) => {
      const position = hexToPixel(hex.col, hex.row);
      minX = Math.min(minX, position.x);
      maxX = Math.max(maxX, position.x);
      minY = Math.min(minY, position.y);
      maxY = Math.max(maxY, position.y);
    });

    const padding = HEX_SIZE * 2;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const oceanGroup = svg.append("g").attr("class", "dice-wars-ocean");
    const territoryGroup = svg
      .append("g")
      .attr("class", "dice-wars-territories");
    const textGroup = svg.append("g").attr("class", "dice-wars-labels");

    hexGrid.forEach((hex) => {
      const isOcean = hex.isOcean || hex.territoryId === null;

      if (!isOcean) return;

      const position = hexToPixel(hex.col, hex.row);
      const centerX = position.x + offsetX;
      const centerY = position.y + offsetY;

      oceanGroup
        .append("path")
        .attr("d", getHexPath(centerX, centerY))
        .attr("fill", "#10252d")
        .attr("stroke", "#081319")
        .attr("stroke-width", 1)
        .attr("opacity", 0.58);
    });

    const drawnTerritories = new Set();

    territories.forEach((territory) => {
      if (drawnTerritories.has(territory.id)) return;
      drawnTerritories.add(territory.id);

      const territoryPath = buildTerritoryPath(
        territory.id,
        hexGrid,
        offsetX,
        offsetY
      );

      if (!territoryPath) return;

      const isSelected = selectedTerritoryId === territory.id;
      const isOwned = territory.playerId === playerId;
      const isCurrentPlayer = gameState.currentTurnPlayerId === playerId;
      const canSelect = isOwned && territory.dice >= 2 && isCurrentPlayer;
      const isNeighborOfSelected =
        selectedTerritoryId != null &&
        territoryMap[selectedTerritoryId]?.neighbors.includes(territory.id);
      const isValidAttackTarget =
        isNeighborOfSelected && !isOwned && isCurrentPlayer;
      const isClickable = isCurrentPlayer && (canSelect || isValidAttackTarget);
      const fillColor = territory.playerId
        ? playerColors[territory.playerId] || "#6f7782"
        : "#3b4148";
      const strokeColor = isSelected
        ? "#f3cf65"
        : isValidAttackTarget
        ? "#f08a4b"
        : "#111820";
      const strokeWidth = isSelected ? 5 : isValidAttackTarget ? 4 : 2;

      const territoryElement = territoryGroup
        .append("path")
        .attr("class", "dice-wars-territory")
        .attr("d", territoryPath)
        .attr("fill", fillColor)
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth)
        .attr("opacity", territory.playerId ? 0.86 : 0.35)
        .style("cursor", isClickable ? "pointer" : "default")
        .on("click", (event) => {
          event.stopPropagation();

          const territoryHex = hexGrid.find(
            (hex) => hex.territoryId === territory.id
          );

          if (territoryHex) handleHexClick(territoryHex);
        });

      if (isClickable) {
        territoryElement
          .on("mouseenter", function () {
            d3.select(this)
              .attr("opacity", 1)
              .attr("stroke-width", isSelected ? 6 : 5);
          })
          .on("mouseleave", function () {
            d3.select(this)
              .attr("opacity", territory.playerId ? 0.86 : 0.35)
              .attr(
                "stroke-width",
                isSelected ? 5 : isValidAttackTarget ? 4 : 2
              );
          });
      }

      const position = hexToPixel(territory.col, territory.row);
      const centerX = position.x + offsetX;
      const centerY = position.y + offsetY;

      textGroup
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("class", "dice-wars-dice-count")
        .text(territory.dice || "");

      textGroup
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY + HEX_SIZE * 0.6)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("class", "dice-wars-territory-id")
        .text(`#${territory.id}`);
    });
  }, [gameState, handleHexClick, playerId, selectedTerritoryId]);

  if (!gameState?.territories) {
    return (
      <section className="dice-wars-board dice-wars-board-pregame">
        <div className="dice-wars-stage">
          <div className="dice-wars-board-center">
            <div className="dice-wars-board-kicker">Dice Wars</div>
            <div className="dice-wars-board-title">Waiting for armies</div>
            <div className="dice-wars-board-subtitle">
              The map will appear once the match begins.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dice-wars-board">
      <DiceWarsTimerFlow timer={turnTimer} hidden={isReview} />

      <div className="dice-wars-statusbar">
        <DiceWarsMetric label="Turn" value={currentTurnName} />
        <DiceWarsMetric
          label="Territories"
          value={`${territoryCounts[playerId] || 0}/${
            gameState.territories.length
          }`}
        />
        <DiceWarsMetric label="My Dice" value={diceCounts[playerId] || 0} />
        <DiceWarsMetric
          label="Round"
          value={
            gameState.MaxRounds
              ? `${gameState.roundNumber}/${gameState.MaxRounds}`
              : gameState.roundNumber
          }
        />
        <DiceWarsMetric
          label="Selected"
          value={selectedTerritory ? `#${selectedTerritory.id}` : "-"}
        />
      </div>

      <div className="dice-wars-stage">
        <DiceWarsScoreboard
          playerIds={playerIds}
          players={players}
          gameState={gameState}
          territoryCounts={territoryCounts}
          diceCounts={diceCounts}
        />
        {showIntro && (
          <DiceWarsIntroModal onClose={() => setShowIntro(false)} />
        )}
        <div className="dice-wars-board-frame">
          <svg ref={svgRef} aria-label="Dice Wars board" />
        </div>
      </div>
    </section>
  );
}

function formatDiceWarsTimerTime(time) {
  const totalSeconds = Math.max(0, Math.ceil(time / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function DiceWarsTimerFlow({ timer, hidden }) {
  if (hidden || !timer?.delay) return null;
  if (timer.hiddenUntil && Date.now() < timer.hiddenUntil) return null;

  const remaining = Math.max(0, timer.delay - (timer.time || 0));
  const percentage = Math.max(0, Math.min(100, (remaining / timer.delay) * 100));
  const isUrgent = remaining <= 5000;

  return (
    <div className={`dice-wars-timer-flow ${isUrgent ? "is-urgent" : ""}`}>
      <div className="dice-wars-timer-flow-meta">
        <span>Turn Timer</span>
        <strong>{formatDiceWarsTimerTime(remaining)}</strong>
      </div>
      <div className="dice-wars-timer-flow-track" aria-hidden="true">
        <div
          className="dice-wars-timer-flow-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DiceWarsScoreboard({
  playerIds,
  players,
  gameState,
  territoryCounts,
  diceCounts,
}) {
  return (
    <div className="dice-wars-scoreboard" aria-label="Territory counts">
      {playerIds.map((playerId) => {
        const isTurn = playerId === gameState.currentTurnPlayerId;
        const playerColor = gameState.playerColors?.[playerId] || "#888";

        return (
          <div
            key={playerId}
            className={`dice-wars-score-pill ${isTurn ? "is-turn" : ""} ${
              territoryCounts[playerId] ? "" : "is-eliminated"
            }`}
          >
            <span
              className="dice-wars-player-color"
              style={{ background: playerColor, color: playerColor }}
            />
            <span className="dice-wars-score-name">
              {getPlayerName(players, playerId)}
            </span>
            <strong>{territoryCounts[playerId] || 0}</strong>
            <em>{diceCounts[playerId] || 0} dice</em>
          </div>
        );
      })}
    </div>
  );
}

function DiceWarsIntroModal({ onClose }) {
  return (
    <div className="dice-wars-intro-backdrop" onClick={onClose}>
      <div className="dice-wars-intro" onClick={(event) => event.stopPropagation()}>
        <h2>Dice Wars</h2>
        <p>
          Attack neighboring territories by rolling dice. Connected territories
          strengthen your reinforcements at the end of your turn.
        </p>
        <button type="button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

function DiceWarsMetric({ label, value }) {
  return (
    <div className="dice-wars-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DiceWarsRoster({ gameState }) {
  const game = useContext(GameContext);

  if (!gameState?.territories) return <></>;

  const territoryCounts = getTerritoryCounts(gameState);
  const diceCounts = getDiceCounts(gameState);
  const playerIds = getPlayerIds(gameState, game.players);

  return (
    <SideMenu
      title="Armies"
      scrollable
      content={
        <div className="dice-wars-roster">
          {playerIds.map((playerId) => (
            <DiceWarsPlayerRow
              key={playerId}
              playerId={playerId}
              player={game.players?.[playerId]}
              playerColor={gameState.playerColors?.[playerId] || "#888"}
              territoryCount={territoryCounts[playerId] || 0}
              diceCount={diceCounts[playerId] || 0}
              isCurrentPlayer={playerId === game.self}
              isTurn={playerId === gameState.currentTurnPlayerId}
            />
          ))}
        </div>
      }
    />
  );
}

function DiceWarsPlayerRow({
  playerId,
  player,
  playerColor,
  territoryCount,
  diceCount,
  isCurrentPlayer,
  isTurn,
}) {
  const displayName = isCurrentPlayer ? "You" : player?.name || "Unknown";
  const isEliminated = territoryCount === 0;

  return (
    <button
      type="button"
      className={`dice-wars-player-row ${isCurrentPlayer ? "is-self" : ""} ${
        isTurn ? "is-turn" : ""
      } ${isEliminated ? "is-eliminated" : ""}`}
      onClick={() => {
        if (player?.userId) window.open(`/user/${player.userId}`, "_blank");
      }}
    >
      <span
        className="dice-wars-player-color"
        style={{ background: playerColor, color: playerColor }}
      />
      <span className="dice-wars-player-avatar">
        <Avatar
          hasImage={player?.avatar}
          id={player?.userId}
          name={player?.name || "Unknown"}
          mediumlarge
        />
      </span>
      <span className="dice-wars-player-name" title={displayName}>
        {displayName}
      </span>
      <span className="dice-wars-player-meta">
        <strong>{territoryCount}</strong>
        <em>{diceCount} dice</em>
      </span>
    </button>
  );
}
