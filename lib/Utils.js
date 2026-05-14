const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const platformBranding = require("./platformBranding");

const AVATAR_UPLOAD_PATH = "stores/avatars";
const SHOP_ITEMS_UPLOAD_PATH = "stores/items";
const EMOTES_UPLOAD_PATH = "stores/emotes";
const EMOTE_GROUPS_UPLOAD_PATH = "stores/emote-groups";
const GAME_CATALOG_UPLOAD_PATH = "game-catalog";
const STAMP_UPLOAD_PATH = "stores/stamps";
const FANART_UPLOAD_PATH = "fanart";
const BRANDING_LOGO_UPLOAD_PATH = "branding";
const BRANDING_BANNER_UPLOAD_PATH = "branding/banners";
const BRANDING_CARSOUEL_UPLOAD_PATH = "branding/banners/carousel";

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

function getUploadAbsolutePath(relativePath, key) {
  return path.join(getUploadRoot(), relativePath, `${key}.webp`);
}

function resolveUploadPath(relativePath) {
  return path.join(getUploadRoot(), relativePath);
}

function toPublicUrl(relativePath, key) {
  const uploadPath = process.env.UPLOAD_PATH || "uploads";
  return `/${uploadPath}/${relativePath}/${key}.webp`;
}

function removeUploadFile(relativePath) {
  if (!relativePath) return;

  const filePath = path.join(__dirname, "..", relativePath);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    fs.unlinkSync(filePath);
  }
}

function removeUploadDir(relativePath) {
  if (!relativePath) return;

  const uploadRoot = path.resolve(getUploadRoot());
  const dirPath = path.resolve(uploadRoot, relativePath);
  if (dirPath !== uploadRoot && !dirPath.startsWith(`${uploadRoot}${path.sep}`)) return;

  if (dirPath && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

async function uploadImage(filePath, relativePath, key, options = {}) {

  const absolutePath = getUploadAbsolutePath(relativePath, key);

  ensureDirectory(path.dirname(absolutePath));
  removeUploadFile(toPublicUrl(relativePath, key));

  let transformer = sharp(filePath, { animated: true });

  if (options.resize) {
    transformer = transformer.resize(options.resize);
  }

  transformer = transformer.webp({ quality: options.quality || 92 });

  await transformer.toFile(absolutePath);

  return toPublicUrl(relativePath, key);
}

module.exports = {
  AVATAR_UPLOAD_PATH,
  SHOP_ITEMS_UPLOAD_PATH,
  EMOTES_UPLOAD_PATH,
  EMOTE_GROUPS_UPLOAD_PATH,
  GAME_CATALOG_UPLOAD_PATH,
  STAMP_UPLOAD_PATH,
  FANART_UPLOAD_PATH,
  BRANDING_LOGO_UPLOAD_PATH,
  BRANDING_BANNER_UPLOAD_PATH,
  BRANDING_CARSOUEL_UPLOAD_PATH,
  ensureDirectory,
  removeUploadFile,
  uploadImage,
  resolveUploadPath,
  toPublicUrl,
  removeUploadDir
};
