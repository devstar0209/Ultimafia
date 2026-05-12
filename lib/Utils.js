const fs = require("fs");
const path = require("path");

const BRANDING_KEY = "branding";

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

module.exports = {
  BRANDING_KEY,
  ensureDirectory,
  getUploadRoot
};
