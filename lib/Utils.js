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

function findUploadedFilePath(relativePath, key) {
  const uploadRoot = getUploadRoot();

  const targetDir = path.join(uploadRoot, relativePath);

  if (!fs.existsSync(targetDir)) {
    return null;
  }

  const baseName = path.parse(key).name;

  const files = fs.readdirSync(targetDir);

  const match = files.find((file) => {
    return file
      .toLowerCase()
      .startsWith(baseName.toLowerCase() + ".");
  });

  return match
    ? path.join(targetDir, match)
    : null;
}

function removeUploadedFile(relativePath, key) {
  const filePath = findUploadedFilePath(relativePath, key);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
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
