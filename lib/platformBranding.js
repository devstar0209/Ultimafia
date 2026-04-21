const fs = require("fs");
const path = require("path");

const BRANDING_KEY = "default";

const GAME_TYPES = [
  "Mafia",
  "Resistance",
  "Jotto",
  "Acrotopia",
  "Secret Dictator",
  "Wacky Words",
  "Liars Dice",
  "Texas Hold Em",
  "Cheat",
  "Ratscrew",
  "Battlesnakes",
  "Connect Four",
  "Dice Wars",
];

const BANNER_KEYS = ["welcome"];

const gameTypeFileMap = {
  Mafia: "Mafia",
  Resistance: "Resistance",
  Jotto: "Jotto",
  Acrotopia: "Acrotopia",
  "Secret Dictator": "SecretDictator",
  "Wacky Words": "WackyWords",
  "Liars Dice": "LiarsDice",
  "Texas Hold Em": "TexasHoldEm",
  Cheat: "Cheat",
  Ratscrew: "Ratscrew",
  Battlesnakes: "Battlesnakes",
  "Connect Four": "ConnectFour",
  "Dice Wars": "DiceWars",
};

function getUploadRoot() {
  const uploadPath = process.env.UPLOAD_PATH || "uploads";
  if (path.isAbsolute(uploadPath)) {
    return uploadPath;
  }

  return path.join(__dirname, "..", uploadPath);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/");
}

function toPublicUrl(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  return normalizedPath ? `/uploads/${normalizedPath}` : "";
}

function toCacheablePublicUrl(relativePath, updatedAt) {
  const url = toPublicUrl(relativePath);
  if (!url || !updatedAt) {
    return url;
  }

  return `${url}?t=${updatedAt}`;
}

function resolveUploadPath(relativePath) {
  return path.join(getUploadRoot(), ...normalizeRelativePath(relativePath).split("/"));
}

function getPlatformLogoRelativePath() {
  return "branding/platform/logo.webp";
}

function getBannerRelativePath(key) {
  return `branding/banners/${key}.webp`;
}

function getGameLogoRelativePath(gameType) {
  const fileName = gameTypeFileMap[gameType];
  if (!fileName) {
    return "";
  }

  return `branding/game-logos/${fileName}.webp`;
}

function buildBrandingPayload(doc) {
  const updatedAt = Number(doc?.updatedAt || 0);
  const platformLogoUrl = toCacheablePublicUrl(doc?.platformLogoPath, updatedAt);
  const banners = {};
  const gameLogos = {};

  for (const key of BANNER_KEYS) {
    banners[key] = toCacheablePublicUrl(doc?.banners?.[key], updatedAt);
  }

  for (const gameType of GAME_TYPES) {
    gameLogos[gameType] = toCacheablePublicUrl(
      doc?.gameLogos?.[gameType],
      updatedAt
    );
  }

  return {
    platformLogoUrl,
    banners,
    gameLogos,
    updatedAt,
  };
}

module.exports = {
  BANNER_KEYS,
  BRANDING_KEY,
  GAME_TYPES,
  buildBrandingPayload,
  ensureDirectory,
  getBannerRelativePath,
  getGameLogoRelativePath,
  getPlatformLogoRelativePath,
  resolveUploadPath,
  toPublicUrl,
};
