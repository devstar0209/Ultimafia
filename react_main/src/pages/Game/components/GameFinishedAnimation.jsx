import React from "react";

export function getWinnerSummary(winnersInfo) {
  const winnerGroups = winnersInfo?.groups || [];

  if (winnerGroups.length === 0) return "The game is complete.";
  if (winnerGroups.length === 1) return `${winnerGroups[0]} won.`;

  return `${winnerGroups.join(", ")} won.`;
}

export default function GameFinishedAnimation({
  visible,
  playerWon,
  winnersInfo,
  onClick,
}) {
  if (!visible) return null;

  const isWin = playerWon === true;
  const isLoss = playerWon === false;
  const title = isWin ? "Victory" : isLoss ? "Failed" : "Game Over";
  const emoticons = isWin
    ? ["\u{1F3C6}", "\u{1F389}", "\u2728", "\u{1F44F}", "\u2B50", "\u{1F48E}"]
    : isLoss
      ? ["\u{1F480}", "\u{1F494}", "\u{1F635}", "\u26A0\uFE0F", "\u{1F940}", "\u2716\uFE0F"]
      : ["\u{1F3B2}", "\u2B50", "!", "?", "\u2728", "\u2022"];

  return (
    <div
      className={`game-finished-animation ${
        isWin ? "is-win" : isLoss ? "is-loss" : "is-neutral"
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-live="polite"
      aria-label={isWin ? "View your reward" : isLoss ? "Leave game" : "Continue"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="game-finished-burst" />
      <div className="game-finished-emoticons" aria-hidden="true">
        {emoticons.map((emoticon, index) => (
          <span key={`${emoticon}-${index}`}>{emoticon}</span>
        ))}
      </div>
      <div className="game-finished-result">
        <div className="game-finished-icon">
          {isWin ? "\u{1F3C6}" : isLoss ? "\u{1F480}" : "\u{1F3B2}"}
        </div>
        <div className="game-finished-title">{title}</div>
        <div className="game-finished-subtitle">
          {getWinnerSummary(winnersInfo)}
        </div>
        <div className="game-finished-action">
          {isWin ? "View reward" : "Leave game"}
        </div>
      </div>
    </div>
  );
}
