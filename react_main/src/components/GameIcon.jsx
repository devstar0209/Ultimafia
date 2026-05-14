import React, { useContext } from "react";
import { Box } from "@mui/material";

import { SiteInfoContext } from "../Contexts";

export function getGameIconSrc(gameType, gameCatalogMap) {
  return gameCatalogMap?.[gameType]?.logoUrl || "";
}

export default function GameIcon(props) {
  const siteInfo = useContext(SiteInfoContext);
  const gameType = props.gameType;
  const size = props.size;
  const circular = props.circular;
  const src = props.src || getGameIconSrc(gameType, siteInfo?.gameCatalogMap);
  const label = String(props.alt ?? gameType ?? "");
  const sx = {
    display: "block",
    objectFit: "cover",
    width: size,
    height: size,
    ...(circular
      ? {
          borderRadius: "50%",
          overflow: "hidden",
        }
      : {}),
    ...props.sx,
  };

  if (src) {
    return (
      <Box
        component="img"
        className={`game-icon ${props.className || ""}`}
        src={src}
        alt={label}
        width={size}
        height={size}
        sx={sx}
        style={props.style}
      />
    );
  }

  return (
    <Box
      component="span"
      className={`game-icon ${props.className || ""}`}
      aria-label={label || undefined}
      title={gameType}
      sx={{
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        color: "inherit",
        display: "inline-flex",
        fontSize: size ? Math.max(Math.round(size * 0.36), 10) : "0.8rem",
        fontWeight: 700,
        justifyContent: "center",
        ...sx,
      }}
      style={props.style}
    >
      {String(gameType || "?").charAt(0)}
    </Box>
  );
}
