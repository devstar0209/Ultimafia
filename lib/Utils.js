const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const platformBranding = require("./platformBranding");

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

function removeUploadedFile(relativePath, key) {
  
}

async function uploadImage(file, relativePath, key, options = {}) {

  const absolutePath = getUploadAbsolutePath(relativePath, key);

  ensureDirectory(path.dirname(absolutePath));
  removeUploadedFile(relativePath, key);

  let transformer = sharp(file.path, { animated: true });

  if (options.resize) {
    transformer = transformer.resize(options.resize);
  }

  transformer = transformer.webp({ quality: options.quality || 92 });

  await transformer.toFile(absolutePath);

  return absolutePath;
}

module.exports = {
  ensureDirectory,
  removeUploadedFile,
  uploadImage,
};
