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
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import { Avatar } from "../User/User";
import { PolicyTracks } from "./SDPolicyTracks";
import { PlayerCircle } from "./SDPlayerCircle";
import { SDPolicyAction } from "./SDPolicyAction";

import "css/game.css";
import "css/gameSecretDictator.css";

const PRIMARY_MEETING_ACTIONS = new Set([
  "Nominate Chancellor",
  "Election Vote",
  "Execute",
  "Nominate as Presidential Candidate",
  "Investigate Loyalty",
  "Discard Policy",
  "Enact Policy",
  "Enact Policy (No Veto)",
  "Assent Veto",
]);

export default function SecretDictatorGame() {
  const game = useContext(GameContext);
  const { history, updateStateViewing, review } = game;
  const playBellRef = useRef(false);
  const [peekedPolicies, setPeekedPolicies] = useState(null);
  const [loyaltyReveal, setLoyaltyReveal] = useState(null);

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

    socket.on("policyPeek", ({ policies }) => {
      setPeekedPolicies(policies);
    });

    socket.on("loyaltyReveal", ({ name, alignment }) => {
      setLoyaltyReveal({ name, alignment });
    });

    socket.on("winners", () => {});
  }, game.socket);

  const playerPanel = (
    <>
      <SecretDictatorRoster />
      <SpeechFilter />
    </>
  );
  const actionPanel = <SecretDictatorActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="secret-dictator-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerPanel}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="secret-dictator-play-column">
              <SecretDictatorBoard />
              <div className="secret-dictator-action-dock">{actionPanel}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="secret-dictator-side-chat">
                <TextMeetingLayout />
              </div>
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerPanel}
          additionalInfoContent={<SecretDictatorBoard />}
          innerRightContent={
            <>
              <OptionsList />
              {actionPanel}
            </>
          }
          chatTab
        />
        {peekedPolicies && (
          <PolicyPeekModal
            policies={peekedPolicies}
            onClose={() => setPeekedPolicies(null)}
          />
        )}
        {loyaltyReveal && (
          <LoyaltyRevealModal
            name={loyaltyReveal.name}
            alignment={loyaltyReveal.alignment}
            onClose={() => setLoyaltyReveal(null)}
          />
        )}
      </div>
    </GameTypeContext.Provider>
  );
}

function getViewedState(game) {
  return game.history.states?.[game.stateViewing];
}

function getSecretDictatorInfo(game) {
  return getViewedState(game)?.extraInfo || {};
}

function getSecretDictatorMeetings(game) {
  return getViewedState(game)?.meetings || {};
}

function getPhaseLabel(game) {
  if (game.stateViewing < 0) return "Pregame";

  return getViewedState(game)?.name || "-";
}

function getAlivePlayers(game, state) {
  const deadMap = state?.dead || {};

  return Object.values(game.players || {})
    .filter((player) => !player.left)
    .map((player) => ({ ...player, dead: Boolean(deadMap[player.id]) }));
}

function getPlayerByName(game, playerName) {
  return Object.values(game.players || {}).find(
    (player) => player.name === playerName
  );
}

function getPlayerDisplayName(game, playerName) {
  const player = getPlayerByName(game, playerName);

  return player?.id === game.self ? "You" : playerName;
}

function findMeeting(game, predicate) {
  return Object.values(getSecretDictatorMeetings(game)).find(predicate);
}

function findPrimaryMeetings(game) {
  return {
    nominationMeeting: findMeeting(
      game,
      (meeting) =>
        meeting.actionName === "Nominate Chancellor" &&
        meeting.canVote &&
        meeting.voting
    ),
    electionMeeting: findMeeting(
      game,
      (meeting) => meeting.actionName === "Election Vote" && meeting.voting
    ),
    executiveMeeting: findMeeting(
      game,
      (meeting) =>
        [
          "Execute",
          "Nominate as Presidential Candidate",
          "Investigate Loyalty",
        ].includes(meeting.actionName) &&
        meeting.canVote &&
        meeting.voting
    ),
    discardMeeting: findMeeting(
      game,
      (meeting) =>
        meeting.actionName === "Discard Policy" &&
        meeting.canVote &&
        meeting.voting
    ),
    enactMeeting: findMeeting(
      game,
      (meeting) =>
        (meeting.actionName === "Enact Policy" ||
          meeting.actionName === "Enact Policy (No Veto)") &&
        meeting.canVote &&
        meeting.voting
    ),
    vetoMeeting: findMeeting(
      game,
      (meeting) =>
        meeting.actionName === "Assent Veto" && meeting.canVote && meeting.voting
    ),
  };
}

function isSecretDictatorPrimaryMeeting(meeting) {
  return PRIMARY_MEETING_ACTIONS.has(meeting.actionName || meeting.name);
}

function SecretDictatorActions() {
  return (
    <ActionList
      scrollable={false}
      hideIfEmpty
      meetingFilter={(meeting) => !isSecretDictatorPrimaryMeeting(meeting)}
    />
  );
}

function PolicyPeekModal({ policies, onClose }) {
  return (
    <div className="sd-peek-overlay" onClick={onClose}>
      <div className="sd-peek-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sd-peek-title">Policy Peek</div>
        <div className="sd-peek-subtitle">Next 3 policies in the draw pile</div>
        <div className="sd-peek-cards">
          {policies.map((policy, i) => {
            const isLiberal = policy === "Liberal";
            return (
              <div
                key={i}
                className={`sd-peek-card sd-peek-card--${
                  isLiberal ? "liberal" : "fascist"
                }`}
              >
                {policy}
              </div>
            );
          })}
        </div>
        <button className="sd-peek-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function LoyaltyRevealModal({ name, alignment, onClose }) {
  const isFascist = alignment === "Fascists";

  return (
    <div className="sd-peek-overlay" onClick={onClose}>
      <div className="sd-peek-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sd-peek-title">Loyalty Investigation</div>
        <div className="sd-peek-subtitle">Classified - eyes only</div>
        <div
          className={`sd-loyalty-badge sd-loyalty-badge--${
            isFascist ? "fascist" : "liberal"
          }`}
        >
          <div className="sd-loyalty-name">{name}</div>
          <div className="sd-loyalty-alignment">{alignment}</div>
        </div>
        <button className="sd-peek-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function SecretDictatorBoard() {
  const game = useContext(GameContext);
  const isPhoneDevice = useIsPhoneDevice();
  const state = getViewedState(game);
  const info = getSecretDictatorInfo(game);
  const policyInfo = info.policyInfo || {};
  const candidateInfo = info.candidateInfo || {};
  const deckInfo = info.deckInfo || {};
  const electionTracker = info.electionInfo?.electionTracker ?? 0;

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="sd-board sd-board-pregame">
        <div className="sd-chamber">
          <div className="sd-board-center">
            <div className="sd-board-kicker">Secret Dictator</div>
            <div className="sd-board-title">Awaiting first election</div>
            <div className="sd-board-subtitle">
              The cabinet table will open once the first presidential candidate
              is assigned.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const players = getAlivePlayers(game, state);
  const meetings = findPrimaryMeetings(game);

  return (
    <section className="sd-board">
      <div className="sd-statusbar">
        <SecretDictatorMetric label="Phase" value={getPhaseLabel(game)} />
        <SecretDictatorMetric
          label="President"
          value={
            candidateInfo.presidentialNominee
              ? getPlayerDisplayName(game, candidateInfo.presidentialNominee)
              : "-"
          }
        />
        <SecretDictatorMetric
          label="Chancellor"
          value={
            candidateInfo.chancellorNominee
              ? getPlayerDisplayName(game, candidateInfo.chancellorNominee)
              : "-"
          }
        />
        <SecretDictatorMetric
          label="Tracker"
          value={`${electionTracker}/3`}
        />
        <SecretDictatorMetric label="Deck" value={deckInfo.deckSize ?? "-"} />
      </div>

      <div className="sd-chamber">
        <div className="sd-government-summary">
          <div className="sd-score-block sd-score-block--liberal">
            <span>Liberals</span>
            <strong>{policyInfo.liberalPolicyCount ?? 0}</strong>
            <em>5 policies</em>
          </div>
          <div className="sd-cabinet-panel">
            <CabinetSeat
              label="President"
              name={candidateInfo.presidentialNominee}
            />
            <CabinetSeat
              label="Chancellor"
              name={candidateInfo.chancellorNominee}
            />
          </div>
          <div className="sd-score-block sd-score-block--fascist">
            <span>Fascists</span>
            <strong>{policyInfo.fascistPolicyCount ?? 0}</strong>
            <em>6 policies</em>
          </div>
        </div>

        <div className="sd-table-wrap">
          {isPhoneDevice ? (
            <>
              <PolicyTracks
                policyInfo={policyInfo}
                presidentialPowersBoard={info.presidentialPowersBoard}
                electionTracker={electionTracker}
                deckInfo={info.deckInfo}
              />
              <SDPolicyAction
                discardMeeting={meetings.discardMeeting}
                enactMeeting={meetings.enactMeeting}
                vetoMeeting={meetings.vetoMeeting}
                socket={game.socket}
              />
              <SDElectionVote
                electionMeeting={meetings.electionMeeting}
                selfId={game.self}
                socket={game.socket}
                mobile
              />
              <PlayerCircle
                players={players}
                candidateInfo={candidateInfo}
                nominationMeeting={meetings.nominationMeeting}
                executiveMeeting={meetings.executiveMeeting}
                electionMeeting={meetings.electionMeeting}
                voteResults={info.lastVoteResults}
                selfId={game.self}
                socket={game.socket}
                roles={state.roles || {}}
                mobile
                externalVoteButtons
              />
            </>
          ) : (
            <div className="sd-table">
              <PlayerCircle
                players={players}
                candidateInfo={candidateInfo}
                nominationMeeting={meetings.nominationMeeting}
                executiveMeeting={meetings.executiveMeeting}
                electionMeeting={meetings.electionMeeting}
                voteResults={info.lastVoteResults}
                selfId={game.self}
                socket={game.socket}
                roles={state.roles || {}}
                externalVoteButtons
              />
              <div className="sd-tracks-center-overlay">
                <PolicyTracks
                  policyInfo={policyInfo}
                  presidentialPowersBoard={info.presidentialPowersBoard}
                  electionTracker={electionTracker}
                  deckInfo={info.deckInfo}
                />
              </div>
              <SDElectionVote
                electionMeeting={meetings.electionMeeting}
                selfId={game.self}
                socket={game.socket}
              />
              <SDPolicyAction
                discardMeeting={meetings.discardMeeting}
                enactMeeting={meetings.enactMeeting}
                vetoMeeting={meetings.vetoMeeting}
                socket={game.socket}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SecretDictatorMetric({ label, value }) {
  return (
    <div className="sd-metric">
      <span>{label}</span>
      <strong title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
    </div>
  );
}

function CabinetSeat({ label, name }) {
  const game = useContext(GameContext);
  const displayName = name ? getPlayerDisplayName(game, name) : "Unassigned";

  return (
    <div className="sd-cabinet-seat">
      <span>{label}</span>
      <strong title={displayName}>{displayName}</strong>
    </div>
  );
}

function SecretDictatorRoster() {
  const game = useContext(GameContext);
  const state = getViewedState(game);
  const info = getSecretDictatorInfo(game);
  const candidateInfo = info.candidateInfo || {};
  const electionMeeting = findPrimaryMeetings(game).electionMeeting;
  const players = getAlivePlayers(game, state);

  if (game.stateViewing < 0 || !state) {
    return <PlayerList />;
  }

  return (
    <div className="side-menu scrollable secret-dictator-roster-menu">
      <div className="title-box">Cabinet</div>
      <div className="side-menu-content">
        <div className="secret-dictator-roster">
          {players.map((player) => (
            <SecretDictatorPlayerRow
              key={player.id}
              player={player}
              candidateInfo={candidateInfo}
              role={state.roles?.[player.id]}
              vote={
                electionMeeting
                  ? electionMeeting.votes?.[player.id]
                  : info.lastVoteResults?.[player.id]
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SecretDictatorPlayerRow({ player, candidateInfo, role, vote }) {
  const game = useContext(GameContext);
  const isSelf = player.id === game.self;
  const tags = [];

  if (player.name === candidateInfo.presidentialNominee) tags.push("President");
  if (player.name === candidateInfo.chancellorNominee) tags.push("Chancellor");
  if (
    player.name === candidateInfo.lastElectedPresident &&
    player.name !== candidateInfo.presidentialNominee
  ) {
    tags.push("Former President");
  }
  if (
    player.name === candidateInfo.lastElectedChancellor &&
    player.name !== candidateInfo.chancellorNominee
  ) {
    tags.push("Former Chancellor");
  }
  if (vote) tags.push(vote);
  if (role) tags.push(role);
  if (player.dead) tags.push("Dead");

  return (
    <button
      type="button"
      className={`secret-dictator-player-row ${
        player.dead ? "is-dead" : ""
      } ${isSelf ? "is-self" : ""}`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <Avatar
        hasImage={player.avatar}
        id={player.userId}
        name={player.name}
        mediumlarge
      />
      <span className="secret-dictator-player-name" title={player.name}>
        {isSelf ? "You" : player.name}
      </span>
      <span className="secret-dictator-player-tags">
        {tags.map((tag) => (
          <em key={tag}>{tag}</em>
        ))}
      </span>
    </button>
  );
}

function SDElectionVote({ electionMeeting, selfId, socket, mobile }) {
  if (!electionMeeting || !selfId) return null;

  const electionMemberIds = new Set(
    (electionMeeting.members || []).map((member) => member.id)
  );

  if (!electionMemberIds.has(selfId)) return null;

  const myVote = electionMeeting.votes?.[selfId];

  const handleVote = (choice) => {
    socket.send("vote", {
      meetingId: electionMeeting.id,
      selection: choice,
    });
  };

  return (
    <div
      className={`sd-election-vote${
        mobile ? " sd-election-vote--mobile" : ""
      }`}
    >
      <div className="sd-election-vote-label">Your Vote</div>
      <div className="sd-vote-buttons sd-vote-buttons--large">
        <button
          className={`sd-vote-btn sd-vote-btn--large sd-vote-btn--ja${
            myVote === "Ja!" ? " sd-vote-btn--selected" : ""
          }${!myVote ? " sd-vote-btn--pending" : ""}`}
          onClick={() => handleVote("Ja!")}
        >
          Ja!
        </button>
        <button
          className={`sd-vote-btn sd-vote-btn--large sd-vote-btn--nein${
            myVote === "Nein!" ? " sd-vote-btn--selected" : ""
          }${!myVote ? " sd-vote-btn--pending" : ""}`}
          onClick={() => handleVote("Nein!")}
        >
          Nein!
        </button>
      </div>
    </div>
  );
}
