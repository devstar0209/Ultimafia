import React, { useRef, useEffect, useContext, useState } from "react";

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
} from "./Game";
import { GameContext } from "../../Contexts";
import { liarsDiceAudioConfig } from "../../audio/audioConfigs";
import { SideMenu } from "./Game";
import { Avatar } from "../User/User";

import "css/game.css";
import "css/gameLiarsDice.css";

export default function LiarsDiceGame() {
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
    loadAudioFiles(liarsDiceAudioConfig);

    // Make game review start at pregame
    if (review) updateStateViewing({ type: "first" });
  }, [loadAudioFiles, review, updateStateViewing]);

  useSocketListeners((socket) => {
    socket.on("state", () => {
      if (playBellRef.current) game.playAudio("ping");

      playBellRef.current = true;
    });

    socket.on("winners", () => {});
    socket.on("diceRoll", () => {
      game.playAudio("diceRoll");
    });
    socket.on("diceRoll2", () => {
      game.playAudio("diceRoll2");
    });
    socket.on("gunshot", () => {
      game.playAudio("gunshot");
    });
  }, game.socket);

  const playerList = (
    <>
      {stateViewing < 0 && <PlayerList />}
      <LiarsDiceRoster />
    </>
  );

  const actionList = <LiarsDiceActions />;

  return (
    <GameTypeContext.Provider
      value={{
        singleState: true,
      }}
    >
      <div className="liars-dice-game">
        <TopBar />
        <ThreePanelLayout
          leftPanelContent={
            <>
              {playerList}
              <SettingsMenu />
            </>
          }
          centerPanelContent={
            <div className="liars-dice-play-column">
              <LiarsDiceTable />
              <div className="liars-dice-action-dock">{actionList}</div>
            </div>
          }
          rightPanelContent={
            <>
              <OptionsList />
              <div className="liars-dice-side-chat">
                <TextMeetingLayout />
              </div>
              <Notes />
            </>
          }
        />
        <MobileLayout
          outerLeftContent={playerList}
          additionalInfoContent={<LiarsDiceTable />}
          innerRightContent={
            <>
              <OptionsList />
              <LiarsDiceCurrentGuess />
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

function getBidInfo(extraInfo) {
  return extraInfo.bidInfo || {};
}

function getPlayers(extraInfo) {
  return Array.isArray(extraInfo.randomizedPlayers)
    ? extraInfo.randomizedPlayers
    : [];
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

function getPlayerDisplayName(player, self) {
  return player.playerId === self ? "You" : player.playerName;
}

function getCurrentTurnPlayer(players, extraInfo) {
  return players.find((player) => player.userId === extraInfo.whoseTurnIsIt);
}

function getSelfPlayer(players, self) {
  return players.find((player) => player.playerId === self);
}

function getLiarsDiceMeetings(game) {
  const state = getViewedState(game);
  const meetingList = Object.values(state?.meetings || {});

  return {
    amountMeeting: meetingList.find((meeting) => meeting.name === "Amount"),
    faceMeeting: meetingList.find((meeting) => meeting.name === "Face"),
    callLieMeeting: meetingList.find((meeting) => meeting.name === "CallLie"),
    spotOnMeeting: meetingList.find((meeting) => meeting.name === "SpotOn"),
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

function DiceIcon({ value, hidden = false, small = false, className = "" }) {
  return (
    <span
      className={`dice liars-die ${hidden ? "dice-unknown" : `dice-${value}`} ${
        small ? "liars-die-small" : ""
      } ${className}`}
      aria-label={hidden ? "Hidden die" : `Die showing ${value}`}
    />
  );
}

function LiarsDiceActions() {
  const game = useContext(GameContext);
  const {
    amountMeeting,
    faceMeeting,
    callLieMeeting,
    spotOnMeeting,
  } = getLiarsDiceMeetings(game);

  if (game.stateViewing < 0) return null;

  const hasBidMeetings = amountMeeting || faceMeeting;
  const hasChallengeMeetings = callLieMeeting || spotOnMeeting;

  if (!hasBidMeetings && !hasChallengeMeetings) {
    return (
      <SideMenu
        title="Action"
        content={
          <div className="liars-actions liars-actions-empty">
            Waiting for the current bidder.
          </div>
        }
      />
    );
  }

  return (
    <SideMenu
      title="Make A Bid!"
      content={
        <div className="liars-actions">
          {hasBidMeetings && (
            <LiarsBidActions
              amountMeeting={amountMeeting}
              faceMeeting={faceMeeting}
            />
          )}
          {hasChallengeMeetings && (
            <LiarsChallengeActions
              callLieMeeting={callLieMeeting}
              spotOnMeeting={spotOnMeeting}
            />
          )}
        </div>
      }
    />
  );
}

function LiarsBidActions({ amountMeeting, faceMeeting }) {
  const game = useContext(GameContext);
  const canBidAmount = canUseMeeting(game, amountMeeting);
  const canBidFace = canUseMeeting(game, faceMeeting);
  const textOptions = amountMeeting?.textOptions || {};
  const serverAmount = amountMeeting?.votes?.[game.self] || "";
  const selectedFace = faceMeeting?.votes?.[game.self];
  const [amount, setAmount] = useState(serverAmount);

  useEffect(() => {
    setAmount(serverAmount);
  }, [amountMeeting?.id, serverAmount]);

  function normalizeAmount(value) {
    let nextAmount = value.replace(/\n/g, " ");

    if (textOptions.numericOnly) {
      nextAmount = nextAmount.replace(/[^0-9]/g, "");
      if (nextAmount !== "" && nextAmount !== "0") {
        nextAmount = parseInt(nextAmount, 10).toString();
      }
    }

    if (textOptions.minNumber != null && nextAmount !== "") {
      nextAmount = Math.max(
        textOptions.minNumber,
        parseInt(nextAmount, 10)
      ).toString();
    }

    if (textOptions.maxNumber != null && nextAmount !== "") {
      nextAmount = Math.min(
        textOptions.maxNumber,
        parseInt(nextAmount, 10)
      ).toString();
    }

    return nextAmount.substring(0, textOptions.maxLength || 50);
  }

  function submitAmount(event) {
    event.preventDefault();

    if (!canBidAmount || !amountMeeting || amount.length < (textOptions.minLength || 0)) {
      return;
    }

    amountMeeting.votes[game.self] = amount;
    game.socket.send("vote", {
      meetingId: amountMeeting.id,
      selection: amount,
    });
  }

  function submitFace(target) {
    if (!canBidFace || !faceMeeting) return;

    faceMeeting.votes[game.self] = target;
    game.socket.send("vote", {
      meetingId: faceMeeting.id,
      selection: target,
    });
  }

  return (
    <div className="liars-bid-actions">
      {amountMeeting && (
        <form className="liars-amount-form" onSubmit={submitAmount}>
          <input
            className="liars-amount-input"
            value={amount}
            disabled={!canBidAmount}
            inputMode={textOptions.numericOnly ? "numeric" : "text"}
            placeholder="Amount"
            onChange={(event) => setAmount(normalizeAmount(event.target.value))}
          />
          <button
            type="submit"
            className="liars-amount-submit"
            disabled={!canBidAmount || amount.length < (textOptions.minLength || 0)}
          >
            Confirm
          </button>
        </form>
      )}

      {faceMeeting && (
        <div className="liars-face-grid" aria-label="Choose die face">
          {(faceMeeting.targets || []).map((target) => {
            const value = target.replace(/[^0-9]/g, "");
            const isSelected = selectedFace === target;

            return (
              <button
                key={target}
                type="button"
                className={`liars-face-button ${isSelected ? "is-selected" : ""}`}
                disabled={!canBidFace}
                onClick={() => submitFace(target)}
              >
                <DiceIcon value={value} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiarsChallengeActions({ callLieMeeting, spotOnMeeting }) {
  const game = useContext(GameContext);
  const actions = [
    {
      meeting: callLieMeeting,
      label: "Call Lie",
      className: "is-lie",
    },
    {
      meeting: spotOnMeeting,
      label: "Spot On",
      className: "is-spot-on",
    },
  ].filter((action) => action.meeting);

  function submitChallenge(meeting) {
    if (!canUseMeeting(game, meeting)) return;

    meeting.votes[game.self] = "Yes!";
    game.socket.send("vote", {
      meetingId: meeting.id,
      selection: "Yes!",
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="liars-challenge-actions">
      {actions.map(({ meeting, label, className }) => (
        <button
          key={meeting.id}
          type="button"
          className={`liars-challenge-button ${className}`}
          disabled={!canUseMeeting(game, meeting)}
          onClick={() => submitChallenge(meeting)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LiarsDiceCurrentGuess() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const bidInfo = getBidInfo(extraInfo);
  const players = getPlayers(extraInfo);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);
  const title = `${currentTurnPlayer?.playerName || bidInfo.currentBidder || "-"}'s turn`;

  return (
    <SideMenu
      title={title}
      content={
        <LiarsDiceBidSummary extraInfo={extraInfo} compact />
      }
    />
  );
}

function LiarsDiceBidSummary({ extraInfo, compact = false }) {
  const bidInfo = getBidInfo(extraInfo);
  const { allDice, lastAmountBid, lastFaceBid, lastBidder } = bidInfo;
  const hasBid = Boolean(lastBidder);
  const bidPercent =
    allDice > 0 && lastAmountBid
      ? Math.min(100, (Math.min(lastAmountBid, allDice) / allDice) * 100)
      : 0;

  return (
    <div className={`liars-bid-summary ${compact ? "is-compact" : ""}`}>
      <div
        className="liars-bid-ring"
        style={{
          "--bid-progress": `${bidPercent}%`,
        }}
      >
        <strong>{hasBid ? lastAmountBid : "-"}</strong>
      </div>
      <div className="liars-bid-face">
        {hasBid ? <DiceIcon value={lastFaceBid} /> : <DiceIcon hidden />}
      </div>
      <div className="liars-bid-copy">
        <span>{hasBid ? "Current bid" : "Opening bid"}</span>
        <strong>{hasBid ? `${lastBidder}'s bet` : "No bid yet"}</strong>
      </div>
    </div>
  );
}

function LiarsDiceTable() {
  const game = useContext(GameContext);
  const state = getViewedState(game);

  if (game.stateViewing < 0 || !state) {
    return (
      <section className="liars-table-stage liars-table-stage-pregame">
        <div className="liars-table-felt">
          <div className="liars-table-center">
            <div className="liars-table-kicker">Liars Dice</div>
            <div className="liars-table-title">Waiting for players</div>
            <div className="liars-table-subtitle">
              Dice cups will appear once the round begins.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const extraInfo = state.extraInfo || {};
  const bidInfo = getBidInfo(extraInfo);
  const players = getPlayers(extraInfo);
  const activePlayers = players.filter((player) => player.rolledDice?.length);
  const currentTurnPlayer = getCurrentTurnPlayer(players, extraInfo);
  const selfPlayer = getSelfPlayer(players, game.self);
  const seatRails = getSeatRails(players, game.self);

  return (
    <section
      className={`liars-table-stage ${
        extraInfo.isTheFlyingDutchman ? "is-dutchman" : ""
      }`}
    >
      <div className="liars-table-statusbar">
        <LiarsMetric
          label="Players"
          value={`${activePlayers.length || players.length}/${players.length}`}
        />
        <LiarsMetric label="Dice In Play" value={bidInfo.allDice ?? "-"} />
        <LiarsMetric label="Turn" value={currentTurnPlayer?.playerName || "-"} />
        <LiarsMetric
          label="Bid"
          value={
            bidInfo.lastBidder
              ? `${bidInfo.lastAmountBid} x ${bidInfo.lastFaceBid}`
              : "Opening"
          }
        />
      </div>

      <div className="liars-table-felt">
        <div className="liars-seat-rail liars-seat-rail-top">
          {seatRails.top.map((player) => (
            <LiarsSeatCup
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>

        <div className="liars-table-center">
          <div className="liars-table-kicker">Liars Dice</div>
          <LiarsDiceBidSummary extraInfo={extraInfo} />
        </div>

        <div className="liars-seat-rail liars-seat-rail-bottom">
          {seatRails.bottom.map((player) => (
            <LiarsSeatCup
              key={player.userId || player.playerName}
              player={player}
              isCurrentPlayer={player.playerId === game.self}
              isTurn={player.userId === extraInfo.whoseTurnIsIt}
            />
          ))}
        </div>
      </div>

      <div className="liars-table-footer">
        <div className="liars-hero-hand">
          <span>Your dice</span>
          <LiarsDiceLine diceValues={selfPlayer?.rolledDice || []} revealed />
        </div>
        <div className="liars-table-quickstats">
          <LiarsMetric
            label="My Dice"
            value={selfPlayer?.rolledDice?.length ?? 0}
          />
        </div>
      </div>
    </section>
  );
}

function LiarsMetric({ label, value }) {
  return (
    <div className="liars-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LiarsDiceLine({ diceValues, revealed, small = false }) {
  const values = Array.isArray(diceValues) ? diceValues : [];

  if (values.length === 0) {
    return <div className="liars-dice-line is-empty">No dice</div>;
  }

  return (
    <div className="liars-dice-line">
      {values.map((value, index) => (
        <DiceIcon
          key={`${value}-${index}`}
          value={value}
          hidden={!revealed}
          small={small}
        />
      ))}
    </div>
  );
}

function LiarsSeatCup({ player, isCurrentPlayer, isTurn }) {
  const game = useContext(GameContext);
  const gamePlayer = game.players?.[player.playerId] || {};
  const displayName = getPlayerDisplayName(player, game.self);
  const diceCount = Array.isArray(player.rolledDice) ? player.rolledDice.length : 0;

  return (
    <button
      type="button"
      className={`liars-seat-cup ${isCurrentPlayer ? "is-self" : ""} ${
        isTurn ? "is-turn" : ""
      }`}
      onClick={() => window.open(`/user/${player.userId}`, "_blank")}
    >
      <span className="liars-seat-avatar">
        <Avatar
          hasImage={gamePlayer.avatar}
          id={gamePlayer.userId || player.userId}
          name={player.playerName}
          mediumlarge
        />
      </span>
      <span className="liars-seat-name" title={player.playerName}>
        {displayName}
      </span>
      <span className="liars-seat-dice-count">{diceCount} dice</span>
    </button>
  );
}

function LiarsDiceRoster() {
  const game = useContext(GameContext);

  if (game.stateViewing < 0) return <></>;

  const extraInfo = getExtraInfo(game);
  const players = getPlayers(extraInfo);

  return (
    <SideMenu
      title="Dice"
      scrollable
      content={
        <div className="liars-roster">
          {players.map((player) => (
            <LiarsDicePlayerRow
              key={player.userId || player.playerName}
              userId={player.userId}
              playerName={getPlayerDisplayName(player, game.self)}
              diceValues={player.rolledDice}
              previousRolls={player.previousRolls}
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

function LiarsDicePlayerRow({
  userId,
  playerName,
  diceValues,
  previousRolls,
  isCurrentPlayer,
  isTheFlyingDutchman,
  whoseTurnIsIt,
}) {
  previousRolls = previousRolls || [];
  const isSamePlayer = whoseTurnIsIt === userId;
  const revealed = isCurrentPlayer;
  return (
    <div
      className={`liars-dice-player-row ${isCurrentPlayer ? "is-self" : ""} ${
        isSamePlayer ? "is-turn" : ""
      }`}
    >
      <button
        type="button"
        className={`liars-dice-player-name ${
          isCurrentPlayer ? "current-player" : ""
        }`}
        style={
          isTheFlyingDutchman
            ? {
                backgroundColor: isCurrentPlayer ? "#506D56" : "#48654e",
                borderColor: "#3B5841",
                cursor: "pointer",
              }
            : {
                cursor: "pointer",
              }
        }
        onClick={() => window.open(`/user/${userId}`, "_blank")}
      >
        {playerName}
      </button>
      <div
        className="liars-dice-dice-container"
        style={
          isTheFlyingDutchman
            ? {
                borderColor: isSamePlayer ? "grey" : "#3B5841",
              }
            : {
                borderColor: isSamePlayer ? "grey" : undefined,
          }
        }
      >
        <LiarsDiceLine diceValues={diceValues} revealed={revealed} />
        {previousRolls.length > 0 && (
          <div className="previous-rolls">
            <div
              className="previous-rolls-label"
              style={
                isTheFlyingDutchman
                  ? {
                      color: "#8fb79a",
                    }
                  : {}
              }
            >
              Last round
            </div>
            <LiarsDiceLine diceValues={previousRolls} revealed small />
          </div>
        )}
      </div>
    </div>
  );
}
