import React from "react";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Button, Dialog } from "@mui/material";

function getPlayerPrizeCoins(winnersInfo) {
  return Math.max(0, Number(winnersInfo?.entryPrizePerWinner || 0));
}

function PrizeCoinAmount({ amount }) {
  const normalizedAmount = Number(amount || 0);

  return (
    <span
      className="game-reward-coin-amount"
      aria-label={`${normalizedAmount.toLocaleString()} ${
        normalizedAmount === 1 ? "coin" : "coins"
      }`}
    >
      <span>{normalizedAmount.toLocaleString()}</span>
      <i className="fas fa-coins" aria-hidden="true" />
    </span>
  );
}

export default function PrizeModal({ show, winnersInfo, onClose }) {
  const prizeCoins = getPlayerPrizeCoins(winnersInfo);

  return (
    <Dialog
      open={show}
      onClose={onClose}
      className="game-replay-dialog"
      maxWidth="sm"
      fullWidth
    >
      <div className="game-reward-modal">
        <button
          type="button"
          className="game-reward-modal-close"
          onClick={onClose}
          aria-label="Close reward"
        >
          <CloseRoundedIcon fontSize="small" />
        </button>

        <div className="game-reward-modal-hero">
          <div className="game-reward-cup-ring" aria-hidden="true">
            <EmojiEventsRoundedIcon />
            <EmojiEventsRoundedIcon />
          </div>
          <div className="game-reward-cup">
            <EmojiEventsRoundedIcon fontSize="inherit" />
          </div>
          <div className="game-reward-modal-heading">
            <span>Victory Prize</span>
            <strong>
              <PrizeCoinAmount amount={prizeCoins} />
            </strong>
            <p>Your win has been recorded.</p>
          </div>
        </div>

        <div className="game-reward-modal-actions">
          <Button variant="contained" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
