import React, { useRef, useEffect, useContext, useMemo } from "react";

import {
  useSocketListeners,
  ThreePanelLayout,
  TopBar,
  TextMeetingLayout,
  ActionList,
  PlayerList,
  LastWillEntry,
  SpeechFilter,
  SettingsMenu,
  Notes,
  PinnedMessages,
  MobileLayout,
  GameTypeContext,
  InventoryPanel,
  buildActionDescriptors,
} from "./Game";
import { GameContext, SiteInfoContext } from "../../Contexts";
import { mafiaAudioConfig } from "../../audio/audioConfigs";
import { SideMenu } from "./Game";
import { StrategiesPanel, StrategiesSection } from "components/Strategies";
import { RoleCount } from "../../components/Roles";
import { Avatar } from "../User/User";

import "css/gameMafia.css";

export default function MafiaGame() {
  const game = useContext(GameContext);
  const siteInfo = useContext(SiteInfoContext);
  const loadAudioFiles = game.loadAudioFiles;
  const playAudio = game.playAudio;
  const stopAudio = game.stopAudio;
  const review = game.review;
  const socket = game.socket;
  const options = game.options || {};

  const history = game.history;
  const stateViewing = game.stateViewing;
  const updateStateViewing = game.updateStateViewing;
  const self = game.self;

  const playBellRef = useRef(false);

  const gameType = "Mafia";
  const meetings = useMemo(
    () => history.states[stateViewing]?.meetings || {},
    [history.states, stateViewing]
  );

  const baseActionProps = useMemo(
    () => ({
      socket,
      players: game.players,
      self,
      history,
      stateViewing,
    }),
    [socket, game.players, self, history, stateViewing]
  );

  const actionDescriptorData = useMemo(
    () =>
      buildActionDescriptors({
        meetings,
        baseActionProps,
        actionStyle: {},
        inventoryActionStyle: { width: "100%" },
      }),
    [meetings, baseActionProps]
  );

  const isLiveState = history.currentState >= 0;
  const isViewingPregame = game.stateViewing === -1;
  const setupId = game.setup?.id;
  const showInventory =
    game.gameType === gameType && Boolean(game.self) && isLiveState;
  const inventoryItems =
    showInventory && game.players[game.self]
      ? game.players[game.self].inventory || []
      : [];

  const actionList = isViewingPregame ? (
    <>
      {actionDescriptorData.regularActionDescriptors.length > 0 && (
        <ActionList descriptors={actionDescriptorData.regularActionDescriptors} />
      )}
      <StrategiesPanel setupId={setupId} visible={Boolean(setupId)} />
    </>
  ) : (
    <ActionList descriptors={actionDescriptorData.regularActionDescriptors} />
  );

  const mobileActionList = isViewingPregame ? (
    <>
      {actionDescriptorData.regularActionDescriptors.length > 0 && (
        <ActionList descriptors={actionDescriptorData.regularActionDescriptors} />
      )}
      <StrategiesSection setupId={setupId} visible={Boolean(setupId)} />
    </>
  ) : (
    <ActionList descriptors={actionDescriptorData.regularActionDescriptors} />
  );

  // Make player view current state when it changes
  useEffect(() => {
    updateStateViewing({ type: "current" });
  }, [history.currentState, updateStateViewing]);

  useEffect(() => {
    loadAudioFiles(mafiaAudioConfig);

    // Make game review start at pregame
    if (review) updateStateViewing({ type: "first" });
  }, [loadAudioFiles, review, updateStateViewing]);

  // Play music on state change to Night
  useEffect(() => {
    if (review) return;

    const currentState = history.states[history.currentState];
    if (currentState && currentState.name.startsWith("Night")) {
      const currentRole = currentState.roles[self];
      if (currentRole) {
        const currentRoleName = currentRole.split(":")[0];
        const currentAlignment =
          currentRoleName in siteInfo.rolesRaw[gameType]
            ? siteInfo.rolesRaw[gameType][currentRoleName].alignment
            : "";

        switch (currentRoleName) {
          case "Cop":
          case "Detective":
          case "Manhunter":
          case "Tracker":
          case "Watcher":
            playAudio("music/NightInvestigator");
            break;
          case "Baker":
          case "Barista":
          case "Blacksmith":
          case "Chandler":
          case "Cutler":
          case "Demolitionist":
          case "Funsmith":
          case "Gemcutter":
          case "Gunsmith":
          case "Keymaker":
          case "Knight":
          case "Mailman":
          case "Missionary":
          case "Pharmacist":
          case "Reanimator":
          case "Capybara":
            playAudio("music/NightCrafter");
            break;
          case "Doctor":
          case "Surgeon":
          case "Nurse":
          case "Medic":
          case "Dentist":
            playAudio("music/NightProtector");
            break;
          case "Sheriff":
          case "Deputy":
          case "Rival":
            playAudio("music/NightWestern");
            break;
          case "Mayor":
          case "Governor":
          case "Senator":
          case "President":
          case "Prince":
          case "Princess":
          case "King":
          case "Kingmaker":
          case "Queen":
          case "Judge":
            playAudio("music/NightEssential");
            break;
          case "Caroler":
          case "Santa":
          case "Snowman":
          case "Polar Bear":
          case "Snow Queen":
          case "Matchmaker":
            playAudio("music/NightWinter");
            break;
          case "Penguin":
            playAudio("music/NightPenguin");
            break;
          case "Fiddler":
            playAudio("music/NightFiddler");
            break;
          case "Clockmaker":
            playAudio("music/NightClockmaker");
            break;
          case "Pyromaniac":
            playAudio("music/NightPyromaniac");
            break;
          case "Serial Killer":
          case "Mastermind":
          case "Usurper":
          case "Mutineer":
          case "Hellhound":
          case "Grizzly Bear":
          case "Puppeteer":
          case "Supervillain":
            playAudio("music/NightHostile");
            break;
          case "Clown":
          case "Fool":
          case "Trickster":
          case "Prankster":
            playAudio("music/NightFool");
            break;
          case "Joker":
            playAudio("music/NightJoker");
            break;
          case "Siren":
            playAudio("music/NightSiren");
            break;
          case "Warlock":
          case "Monk":
          case "Fatalist":
          case "Prophet":
            playAudio("music/NightFantasy");
            break;
          case "Suitress":
          case "Mistress":
          case "Lover":
          case "Astrologer":
          case "Heartbreaker":
          case "Yandere":
            playAudio("music/NightLove");
            break;
          case "Oracle":
          case "Resurrectionist":
          case "Diviner":
          case "Psychic":
          case "Medium":
          case "Mourner":
          case "Fortune Teller":
          case "Clairvoyant":
          case "Groundskeeper":
          case "Mooncalf":
          case "Graverobber":
          case "Ghostbuster":
          case "Poltergeist":
          case "Banshee":
          case "Ghost":
          case "Vengeful Spirit":
          case "Phantom":
          case "Alien":
          case "Blob":
          case "Doppelgänger":
          case "Grey Goo":
            playAudio("music/NightMystical");
            break;
          case "Egg":
          case "Dodo":
          case "Turkey":
          case "Tofurkey":
          case "Harpy":
          case "Falconer":
            playAudio("music/NightBird");
            break;
          case "Autocrat":
          case "Palladist":
          case "Anarchist":
          case "Communist":
          case "Dragoon":
          case "Emperor":
          case "Politician":
            playAudio("music/NightPolitic");
            break;
          case "Executioner":
            playAudio("music/NightExecutioner");
            break;
          default:
            if (currentAlignment === "Mafia") {
              // If mafia role isn't listed above the mafia track plays
              playAudio("music/NightMafia");
            }
            else if (currentAlignment === "Cult") {
              // If cult role isn't listed above the mafia track plays
              playAudio("music/NightCult");
            }
            else {
              // If no role has assigned music the generic track plays
              playAudio("music/NightGeneric");
            }
            break;
        }
      }
    } else if (
      currentState &&
      (currentState.name.startsWith("Give Clue") ||
        currentState.name.startsWith("Dawn"))
    ) {
      //Night Music Contiunes at Give Clue and Dawn
    } else if (
      history.currentState === -1 &&
      options.competitive
    ) {
      playAudio("music/PregameCompetitive");
    } else if (
      history.currentState === -1 &&
      options.lobby === "Sandbox"
    ) {
      playAudio("music/PregameSandbox");
    } else {
      stopAudio();
    }
  }, [
    history.currentState,
    history.states,
    options.competitive,
    options.lobby,
    playAudio,
    review,
    self,
    siteInfo.rolesRaw,
    stopAudio,
  ]);

  useSocketListeners((socket) => {
    socket.on("state", (state) => {
      if (state && state.name && state.name.startsWith("Give Clue")) {
      } else if (playBellRef.current) {
        playAudio("bell");
      }

      playBellRef.current = true;
    });

    socket.on("winners", (winners) => {
      stopAudio();
      if (winners.groups.includes("Alien")) {
        playAudio("music/WinAlien");
      }
      if (winners.groups.includes("Blob")) {
        playAudio("music/WinBlob");
      }
      if (winners.groups.includes("Prophet")) {
        playAudio("music/WinProphet");
      }
      if (winners.groups.includes("Fool")) {
        playAudio("music/WinFool");
      }
      if (winners.groups.includes("Dodo")) {
        playAudio("music/WinDodo");
      }
      if (winners.groups.includes("Joker")) {
        playAudio("music/WinJoker");
      }
      if (winners.groups.includes("Puppeteer")) {
        playAudio("music/WinPuppeteer");
      }
      if (winners.groups.includes("Matchmaker")) {
        playAudio("music/WinMatchmaker");
      }
      if (winners.groups.includes("Survivor")) {
        playAudio("music/WinSurvivor");
      }
      if (winners.groups.includes("Serial Killer")) {
        playAudio("music/WinKiller");
      }
      if (winners.groups.includes("Cult")) {
        playAudio("music/WinCult");
      }
      if (winners.groups.includes("Village")) {
        playAudio("music/WinVillage");
      }
      if (winners.groups.includes("Angel")) {
        playAudio("music/WinAngel");
      }
      if (winners.groups.includes("Siren")) {
        playAudio("music/WinSiren");
      }
      if (winners.groups.includes("Monk")) {
        playAudio("music/WinMonk");
      }
      if (winners.groups.includes("Lover")) {
        playAudio("music/WinLover");
      }
      if (winners.groups.includes("Astrologer")) {
        playAudio("music/WinAstrologer");
      }
      if (winners.groups.includes("Hellhound")) {
        playAudio("music/WinHellhound");
      }
      if (winners.groups.includes("Warlock")) {
        playAudio("music/WinWarlock");
      }
      if (winners.groups.includes("Creepy Girl")) {
        playAudio("music/WinCreepyGirl");
      }
      if (winners.groups.includes("Autocrat")) {
        playAudio("music/WinAutocrat");
      }
      if (winners.groups.includes("Gambler")) {
        playAudio("music/WinGambler");
      }
      if (winners.groups.includes("Sidekick")) {
        playAudio("music/WinSidekick");
      }
      if (winners.groups.includes("Executioner")) {
        playAudio("music/WinExecutioner");
      }
      if (winners.groups.includes("Clockmaker")) {
        playAudio("music/WinClockmaker");
      }
      if (winners.groups.includes("Mastermind")) {
        playAudio("music/WinMastermind");
      }
      if (winners.groups.includes("Communist")) {
        playAudio("music/WinCommunist");
      }
      if (winners.groups.includes("Pyromaniac")) {
        playAudio("music/WinPyromaniac");
      }
      if (winners.groups.includes("Grey Goo")) {
        playAudio("music/WinGreyGoo");
      }
      if (winners.groups.includes("Mafia")) {
        playAudio("music/WinMafia");
      } else if (winners.groups.includes("No one")) {
        playAudio("music/Draw");
      }
    });

    socket.on("gunshot", () => {
      playAudio("gunshot");
    });
    socket.on("giveClue", (player) => {
      if (player === self) {
        playAudio("ghostAsk");
      }
    });
    socket.on("condemn", () => {
      playAudio("condemn");
    });
    socket.on("explosion", () => {
      playAudio("explosion");
    });
    socket.on("snowball", () => {
      playAudio("snowball");
    });
  }, socket);

  return (
    <GameTypeContext.Provider
      value={{
        singleState: false,
      }}
    >
      <div className="mafia-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              <PlayerList />
              <SpeechFilter />
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="mafia-play-column">
              <MafiaStage />
              <div className="mafia-action-dock">{actionList}</div>
            </div>
          }
          rightPanelContent={
            <>
              <HistoryKeeper history={history} stateViewing={stateViewing} />
              <div className="mafia-side-chat">
                <TextMeetingLayout />
              </div>
              <InventoryPanel
                show={showInventory}
                items={inventoryItems}
                actionsByItemId={actionDescriptorData.inventoryActionDescriptors}
                gameType={gameType}
              />
              <LastWillEntry />
              <PinnedMessages />
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={
            <>
              <PlayerList />
              <SpeechFilter />
            </>
          }
          innerRightContent={
            <>
              <HistoryKeeper history={history} stateViewing={stateViewing} />
              {mobileActionList}
              <InventoryPanel
                show={showInventory}
                items={inventoryItems}
                actionsByItemId={actionDescriptorData.inventoryActionDescriptors}
                gameType={gameType}
              />
              <LastWillEntry />
            </>
          }
          additionalInfoContent={
            <>
              <MafiaStage />
              <PinnedMessages />
              <Notes />
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

function getStatePlayers(game, state) {
  const dead = state?.dead || {};
  const exorcised = state?.exorcised || {};
  const players = Object.values(game.players || {}).filter((player) => !player.left);

  return {
    alive: players.filter((player) => !dead[player.id]),
    dead: players.filter((player) => dead[player.id] && !exorcised[player.id]),
    exorcised: players.filter((player) => exorcised[player.id]),
    all: players,
  };
}

function getBaseStateName(stateName = "Pregame") {
  return stateName.replace(/\s+\d+$/, "");
}

function getPhaseKind(stateName = "Pregame") {
  const baseStateName = getBaseStateName(stateName);

  if (baseStateName === "Night") return "night";
  if (baseStateName === "Dawn") return "dawn";
  if (baseStateName === "Day") return "day";
  if (baseStateName === "Dusk") return "dusk";
  if (baseStateName === "Postgame") return "postgame";
  if (baseStateName === "Pregame") return "pregame";

  return "special";
}

function getRoleName(role = "") {
  return role.split(":")[0] || "";
}

function getRoleModifiers(role = "") {
  return role.split(":")[1] || "";
}

function formatRole(role = "") {
  const roleName = getRoleName(role);
  const modifiers = getRoleModifiers(role);

  if (!roleName) return "Unknown";

  return modifiers ? `${roleName} (${modifiers})` : roleName;
}

function getAlignment(siteInfo, role = "") {
  const roleName = getRoleName(role);

  return siteInfo.rolesRaw?.Mafia?.[roleName]?.alignment || "Hidden";
}

function getSelfStatus(game, state) {
  if (game.isSpectator) return "Spectating";
  if (!state || game.stateViewing < 0) return "Waiting";
  if (state.exorcised?.[game.self]) return "Exorcised";
  if (state.dead?.[game.self]) return "Dead";

  return "Alive";
}

function getMeetingCounts(state) {
  const meetings = Object.values(state?.meetings || {});

  return {
    speech: meetings.filter((meeting) => meeting.speech).length,
    actions: meetings.filter((meeting) => meeting.voting && !meeting.speech).length,
    unresolved: meetings.filter(
      (meeting) => meeting.voting && meeting.canVote && !meeting.playerHasVoted
    ).length,
  };
}

function MafiaStage() {
  const game = useContext(GameContext);
  const siteInfo = useContext(SiteInfoContext);
  const state = getViewedState(game);
  const stateName = state?.name || "Pregame";
  const phaseKind = getPhaseKind(stateName);
  const players = getStatePlayers(game, state);
  const meetingCounts = getMeetingCounts(state);
  const selfRole = state?.roles?.[game.self] || "";
  const selfStatus = getSelfStatus(game, state);
  const clueCount = state?.extraInfo?.currentClueHistory?.length || 0;
  const isPregame =
    game.stateViewing === -1 || getBaseStateName(stateName) === "Pregame";
  const anonymousGame = game.options?.anonymousGame;

  return (
    <section className={`mafia-stage is-${phaseKind}`}>
      <div className="mafia-statusbar">
        <MafiaMetric label="Phase" value={stateName} />
        <MafiaMetric label="Alive" value={`${players.alive.length}/${players.all.length}`} />
        <MafiaMetric label="Graveyard" value={players.dead.length} />
        <MafiaMetric label="Actions" value={meetingCounts.unresolved} />
      </div>

      <div className="mafia-town-board">
        <div className="mafia-role-spotlight">
          <div>
            <span className="mafia-kicker">{isPregame ? "Mafia" : "Your role"}</span>
            <strong>{isPregame ? "Waiting for the town" : formatRole(selfRole)}</strong>
          </div>
          {!isPregame && selfRole && (
            <RoleCount role={selfRole} gameType="Mafia" showPopover />
          )}
          <div className="mafia-role-tags">
            <span className={`mafia-pill is-${selfStatus.toLowerCase()}`}>
              {selfStatus}
            </span>
            {!isPregame && (
              <span className="mafia-pill">
                {getAlignment(siteInfo, selfRole)}
              </span>
            )}
          </div>
        </div>

        <div className="mafia-phase-card">
          <span className="mafia-kicker">{getBaseStateName(stateName)}</span>
          <strong>{isPregame ? "Pregame lobby" : `${players.alive.length} still standing`}</strong>
          <p>
            {isPregame
              ? "The game will open once the host starts the setup."
              : `${meetingCounts.speech} chat room${
                  meetingCounts.speech === 1 ? "" : "s"
                } and ${meetingCounts.actions} active action panel${
                  meetingCounts.actions === 1 ? "" : "s"
                }.`}
          </p>
        </div>

        <div className="mafia-town-grid" aria-label="Alive players">
          {players.alive.map((player) => (
            <MafiaPlayerToken
              key={player.id}
              player={player}
              state={state}
              self={game.self}
              anonymousGame={anonymousGame}
              stateViewing={game.stateViewing}
            />
          ))}
        </div>

        {(players.dead.length > 0 || players.exorcised.length > 0 || clueCount > 0) && (
          <div className="mafia-lower-track">
            {clueCount > 0 && (
              <div className="mafia-clue-chip">
                <span>Ghost clues</span>
                <strong>{clueCount}</strong>
              </div>
            )}
            {[...players.dead, ...players.exorcised].map((player) => (
              <MafiaPlayerToken
                key={player.id}
                player={player}
                state={state}
                self={game.self}
                anonymousGame={anonymousGame}
                stateViewing={game.stateViewing}
                compact
                dead
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MafiaMetric({ label, value }) {
  return (
    <div className="mafia-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MafiaPlayerToken({
  player,
  state,
  self,
  anonymousGame,
  stateViewing,
  compact = false,
  dead = false,
}) {
  const role = state?.roles?.[player.id] || "";
  const isSelf = player.id === self;
  const canOpenProfile = !(stateViewing >= 0 && anonymousGame);
  const avatarId = player.anonId === undefined ? player.userId : player.anonId;

  function openProfile() {
    if (!canOpenProfile) return;

    window.open(`/user/${player.userId}`, "_blank");
  }

  return (
    <button
      type="button"
      className={`mafia-player-token ${isSelf ? "is-self" : ""} ${
        compact ? "is-compact" : ""
      } ${dead ? "is-dead" : ""}`}
      onClick={openProfile}
      disabled={!canOpenProfile}
    >
      <span className="mafia-token-avatar">
        <Avatar
          hasImage={player.avatar}
          id={player.userId}
          avatarId={avatarId}
          name={player.name}
          mediumlarge={!compact}
          dead={dead}
        />
      </span>
      <span className="mafia-token-name" title={player.name}>
        {isSelf ? "You" : player.name}
      </span>
      {role && state && (
        <span className="mafia-token-role">
          <RoleCount role={role} gameType="Mafia" showPopover />
          <span>{formatRole(role)}</span>
        </span>
      )}
    </button>
  );
}

function HistoryKeeper(props) {
  const history = props.history;
  const stateViewing = props.stateViewing;

  if (stateViewing < 0) return <></>;

  const extraInfo = history.states[stateViewing].extraInfo;

  if (!extraInfo || extraInfo.showGameInfo !== true) {
    return <></>;
  }

  return (
    <SideMenu
      title="Game Info"
      scrollable
      content={
        <>
          <GhostHistory
            //responseHistory={extraInfo.responseHistory}
            currentClueHistory={extraInfo.currentClueHistory}
            word={extraInfo.word}
            wordLength={extraInfo.wordLength}
          />
        </>
      }
    />
  );
}

function GhostHistory(props) {
  //let responseHistory = props.responseHistory;
  let currentClueHistory = props.currentClueHistory;
  let wordLength = props.wordLength;

  return (
    <div className="ghost">
      <div className="ghost-word-info">
        <>
          <div className="ghost-name"> Word Length </div>
          <div className="ghost-input"> {wordLength} </div>
        </>
      </div>
      <div className="ghost-current-history">
        <div className="ghost-name"> Current Round </div>
        <ClueHistory clueHistory={currentClueHistory} />
      </div>
    </div>
  );
}

function ClueHistory(props) {
  let clueHistory = props.clueHistory;

  return (
    <>
      <div className="ghost-history-group">
        {clueHistory.map((c) => (
          <Clue key={c} clue={c} />
        ))}
      </div>
    </>
  );
}

function Clue(props) {
  let c = props.clue;

  return (
    <>
      <div className="ghost-input ghost-clue">
        <span> {c.split(":")[0]} </span> {c.split(":")[1]}
      </div>
    </>
  );
}
