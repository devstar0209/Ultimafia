import React, { useContext } from "react";

import { SiteInfoContext } from "../Contexts";

export const gamesIcons = {
  Mafia: require("images/game_icons/Mafia.png"),
  Resistance: require("images/game_icons/Resistance.png"),
  Jotto: require("images/game_icons/Jotto.png"),
  Acrotopia: require("images/game_icons/Acrotopia.png"),
  "Secret Dictator": require("images/game_icons/SecretDictator.png"),
  "Wacky Words": require("images/game_icons/WackyWords.png"),
  "Liars Dice": require("images/game_icons/LiarsDice.png"),
  "Texas Hold Em": require("images/game_icons/TexasHoldEm.png"),
  Cheat: require("images/game_icons/Cheat.png"),
  Ratscrew: require("images/game_icons/Ratscrew.png"),
  Battlesnakes: require("images/game_icons/Battlesnakes.png"),
  "Connect Four": require("images/game_icons/ConnectFour.png"),
  "Dice Wars": require("images/game_icons/DiceWars.png"),
};

export function getGameIconSrc(gameType, brandingGameLogos, gameCatalogMap) {
  return (
    gameCatalogMap?.[gameType]?.logoUrl ||
    brandingGameLogos?.[gameType] ||
    gamesIcons[gameType]
  );
}

export default function GameIcon(props) {
  const siteInfo = useContext(SiteInfoContext);
  const gameType = props.gameType;
  const size = props.size;
  const circular = props.circular;

  return (
    <img
      className="game-icon"
      src={getGameIconSrc(
        gameType,
        siteInfo?.branding?.gameLogos,
        siteInfo?.gameCatalogMap
      )}
      alt={gameType}
      width={size}
      height={size}
      style={{
        ...(circular
          ? {
              borderRadius: "50%",
              display: "block",
              objectFit: "cover",
              overflow: "hidden",
            }
          : {}),
        ...props.style,
      }}
    />
  );
}
