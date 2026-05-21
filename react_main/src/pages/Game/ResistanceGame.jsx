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
  SideMenu,
} from "./Game";
import { GameContext } from "../../Contexts";
import { Avatar } from "../User/User";

import "css/game.css";

export default function ResistanceGame() {
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
      if (playBellRef.current) game.playAudio("bell");

      playBellRef.current = true;
    });

    socket.on("winners", () => {});
  }, game.socket);

  const playerPanel = (
    <>
      <ResistanceRoster />
      <SpeechFilter />
    </>
  );
  const actionPanel = <ResistanceActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: false,
      }}
    >
      <div className="resistance-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="resistance-play-column">
              <ResistanceBoard />
              <div className="resistance-action-dock">{actionPanel}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="resistance-side-chat">
                <TextMeetingLayout />
              </div>
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={<ResistanceBoard />}
          innerRightContent={actionPanel}
        />
      </div>
    </GameTypeContext.Provider>
  );
}

function getViewedState(game) {
  return game.history.states?.[game.stateViewing];
}

function getResistanceInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getMissionHistory(info) {
  return Array.isArray(info.missionHistory) ? info.missionHistory : [];
}

function getScore(info) {
  return info.score || { rebels: 0, spies: 0 };
}

function getTotalMissions(game, info) {
  return (
    Number(info.numMissions) ||
    Number(game.setup?.gameSettings?.numMissions) ||
    Number(game.options?.gameTypeOptions?.numMissions) ||
    Math.max(getMissionHistory(info).length, 5)
  );
}

function getCurrentMission(game, info) {
  const state = getViewedState(game);

  return (
    Number(info.mission) ||
    Number(state?.mission) ||
    Math.min(getMissionHistory(info).length + 1, getTotalMissions(game, info))
  );
}

function getCurrentTeam(game, info) {
  const currentTeam = Array.isArray(info.currentTeam) ? info.currentTeam : [];

  if (currentTeam.length > 0) return currentTeam;

  const meetings = getViewedState(game)?.meetings || {};
  const assembleMeeting = Object.values(meetings).find(
    (meeting) => meeting.name === "Assemble Team"
  );
  const selectedIds = Object.values(assembleMeeting?.votes || {}).flat();

  return selectedIds
    .map((playerId) => game.players?.[playerId]?.name)
    .filter(Boolean);
}

function getPlayerByName(game, playerName) {
  return Object.values(game.players || {}).find(
    (player) => player.name === playerName
  );
}

function getAlivePlayers(game) {
  const state = getViewedState(game);

  return Object.values(game.players || {}).filter(
    (player) => !player.left && !state?.dead?.[player.id]
  );
}

function getPhaseLabel(game) {
  const state = getViewedState(game);

  if (game.stateViewing < 0) return "Pregame";

  return state?.name || "-";
}

const DIRECT_BUTTON_INPUT_TYPES = new Set([
  "boolean",
  "custom",
  "customBoolean",
  "select",
  "alignment",
  "role",
  "AllRoles",
]);

function shouldRenderAsDirectButtons(meeting) {
  return (
    meeting.voting &&
    DIRECT_BUTTON_INPUT_TYPES.has(meeting.inputType) &&
    Array.isArray(meeting.targets) &&
    meeting.targets.length > 0
  );
}

function getDirectButtonMeetings(game) {
  const meetings = getViewedState(game)?.meetings || {};

  return Object.values(meetings).filter((meeting) =>
    shouldRenderAsDirectButtons(meeting)
  );
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

function ResistanceActions() {
  const game = useContext(GameContext);
  const directButtonMeetings = getDirectButtonMeetings(game);
  const directButtonMeetingIds = new Set(
    directButtonMeetings.map((meeting) => meeting.id)
  );

  return (
    <>
      {directButtonMeetings.map((meeting) => (
        <DirectSelectionActions key={meeting.id} meeting={meeting} />
      ))}
      <ActionList
        scrollable={false}
        hideIfEmpty
        meetingFilter={(meeting) => !directButtonMeetingIds.has(meeting.id)}
      />
    </>
  );
}

function getSelectionTargets(meeting) {
  if (!Array.isArray(meeting.targets)) return [];

  return meeting.targets;
}

function getSelectionLabel(target, meeting) {
  if (Array.isArray(target)) return target.join(", ");
  if (target === "*unknown") return "Unknown";

  if (meeting.inputType === "boolean" && target === "*") return "No";
  if (target === "*") return "None";

  return target;
}

function countVotesForTarget(votes, target) {
  return Object.values(votes || {}).filter((vote) =>
    Array.isArray(vote) ? vote.includes(target) : vote === target
  ).length;
}

function DirectSelectionActions({ meeting }) {
  const game = useContext(GameContext);
  const selectedVote = meeting.votes?.[game.self];
  const selectedVotes = Array.isArray(selectedVote)
    ? selectedVote
    : [selectedVote];
  const canAct = canUseMeeting(game, meeting);
  const targets = getSelectionTargets(meeting);

  function submitVote(target) {
    if (!canAct) return;

    const isSelected = selectedVotes.includes(target);

    game.socket.send(isSelected ? "unvote" : "vote", {
      meetingId: meeting.id,
      selection: target,
    });
  }

  return (
    <SideMenu
      title={meeting.actionName || meeting.name}
      content={
        <div className="resistance-approve-actions">
          {targets.map((target) => {
            const label = getSelectionLabel(target, meeting);
            const isSelected = selectedVotes.includes(target);
            const targetClass = String(label)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");

            return (
              <button
                key={String(target)}
                type="button"
                className={`resistance-approve-button resistance-approve-${targetClass} ${
                  isSelected ? "is-selected" : ""
                }`}
                disabled={!canAct}
                onClick={() => submitVote(target)}
              >
                <span>{label}</span>
                <strong>{countVotesForTarget(meeting.votes, target)}</strong>
              </button>
            );
          })}
        </div>
      }
    />
  );
}

function ResistanceBoard() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getResistanceInfo(game);
  const score = getScore(info);
  const missionHistory = getMissionHistory(info);
  const totalMissions = getTotalMissions(game, info);
  const currentMission = getCurrentMission(game, info);
  const currentTeam = getCurrentTeam(game, info);
  const neededToWin = Math.ceil(totalMissions / 2);

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="resistance-board resistance-board-pregame">
        <div className="resistance-command-map">
          <div className="resistance-board-center">
            <div className="resistance-board-kicker">Resistance</div>
            <div className="resistance-board-title">Awaiting mission start</div>
            <div className="resistance-board-subtitle">
              The operation board will unlock when the first leader is assigned.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="resistance-board">
      <div className="resistance-statusbar">
        <ResistanceMetric label="Phase" value={getPhaseLabel(game)} />
        <ResistanceMetric
          label="Mission"
          value={`${Math.min(currentMission, totalMissions)}/${totalMissions}`}
        />
        <ResistanceMetric
          label="Leader"
          value={info.currentLeaderName || "-"}
        />
        <ResistanceMetric
          label="Team Size"
          value={info.currentTeamSize || currentTeam.length || "-"}
        />
        <ResistanceMetric
          label="Rejections"
          value={`${info.teamFails || 0}/${info.teamFailLimit || "-"}`}
        />
      </div>

      <div className="resistance-command-map">
        <div className="resistance-score-column resistance-score-rebels">
          <span>Resistance</span>
          <strong>{score.rebels || 0}</strong>
          <em>{neededToWin} to win</em>
        </div>

        <div className="resistance-board-center">
          <div className="resistance-mission-track">
            {Array.from({ length: totalMissions }).map((_, index) => (
              <MissionNode
                key={index}
                missionNumber={index + 1}
                mission={missionHistory[index]}
                isCurrent={index + 1 === currentMission}
              />
            ))}
          </div>

          <CurrentTeamPanel currentTeam={currentTeam} />
        </div>

        <div className="resistance-score-column resistance-score-spies">
          <span>Spies</span>
          <strong>{score.spies || 0}</strong>
          <em>{neededToWin} to win</em>
        </div>
      </div>
    </section>
  );
}

function ResistanceMetric({ label, value }) {
  return (
    <div className="resistance-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function MissionNode({ missionNumber, mission, isCurrent }) {
  const rejected = mission?.numFails === -1;
  const success = mission?.numFails === 0;
  const failed = mission?.numFails > 0;
  const stateClass = rejected
    ? "is-rejected"
    : success
    ? "is-success"
    : failed
    ? "is-failed"
    : isCurrent
    ? "is-current"
    : "is-upcoming";
  const label = rejected
    ? "Rejected"
    : success
    ? "Success"
    : failed
    ? `${mission.numFails} fail`
    : isCurrent
    ? "Current"
    : "Pending";
  const team = Array.isArray(mission?.team) ? mission.team.join(", ") : "";

  return (
    <div className={`resistance-mission-node ${stateClass}`}>
      <div className="resistance-mission-number">{missionNumber}</div>
      <div className="resistance-mission-label">{label}</div>
      {team && <div className="resistance-mission-team">{team}</div>}
    </div>
  );
}

function CurrentTeamPanel({ currentTeam }) {
  const game = useContext(GameContext);

  return (
    <div className="resistance-team-panel">
      <div className="resistance-team-heading">
        <span>Selected team</span>
        <strong>{currentTeam.length || 0}</strong>
      </div>
      {currentTeam.length > 0 ? (
        <div className="resistance-team-list">
          {currentTeam.map((playerName) => {
            const player = getPlayerByName(game, playerName);

            return (
              <div className="resistance-team-chip" key={playerName}>
                {player && (
                  <Avatar
                    hasImage={player.avatar}
                    id={player.userId}
                    name={player.name}
                    small
                  />
                )}
                <span title={playerName}>{playerName}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="resistance-empty-team">
          Waiting for the leader to assemble a team.
        </div>
      )}
    </div>
  );
}

function ResistanceRoster() {
  const game = useContext(GameContext);
  const info = getResistanceInfo(game);
  const currentTeam = new Set(getCurrentTeam(game, info));
  const alivePlayers = getAlivePlayers(game);

  if (game.stateViewing < 0) {
    return <PlayerList />;
  }

  return (
    <div className="side-menu scrollable resistance-roster-menu">
      <div className="title-box">Operatives</div>
      <div className="side-menu-content">
        <div className="resistance-roster">
          {alivePlayers.map((player) => (
            <ResistancePlayerRow
              key={player.id}
              player={player}
              isLeader={player.id === info.currentLeaderId}
              isOnTeam={currentTeam.has(player.name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResistancePlayerRow({ player, isLeader, isOnTeam }) {
  return (
    <button
      type="button"
      className={`resistance-player-row ${isLeader ? "is-leader" : ""} ${
        isOnTeam ? "is-on-team" : ""
      }`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <Avatar
        hasImage={player.avatar}
        id={player.userId}
        name={player.name}
        mediumlarge
      />
      <span className="resistance-player-name" title={player.name}>
        {player.name}
      </span>
      <span className="resistance-player-tags">
        {isLeader && <em>Leader</em>}
        {isOnTeam && <em>Team</em>}
      </span>
    </button>
  );
}
