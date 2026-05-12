const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

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

function getUploadExtension(file) {
  const filename = path.basename(
    file.originalFilename || file.name || file.path || ""
  );
  let ext = path.extname(filename).toLowerCase();
  if (ext === ".jpeg") ext = ".jpg";

  const validExts = [".png", ".jpg", ".webp", ".gif", ".avif", ".tiff"];
  if (!validExts.includes(ext)) {
    ext = ".png";
  }

  return ext;
}

function buildUploadRelativePath(basePath, extension) {
  return `${basePath}${extension}`;
}

function getUploadAbsolutePath(basePath, extension) {
  return path.join(getUploadRoot(), buildUploadRelativePath(basePath, extension));
}

function getUploadUrlFromRelativePath(relativePath) {
  return `/uploads/${relativePath.replace(/\\/g, "/")}`;
}

function findUploadedFilePath(basePath) {
  const uploadRoot = getUploadRoot();
  const targetDir = path.dirname(path.join(uploadRoot, basePath));
  const targetBase = path.basename(basePath);

  if (!fs.existsSync(targetDir)) {
    return null;
  }

  const files = fs.readdirSync(targetDir);
  const match = files.find((filename) => {
    const lower = filename.toLowerCase();
    return lower.startsWith(targetBase.toLowerCase() + ".");
  });

  return match ? path.join(targetDir, match) : null;
}

function removeUploadedFile(basePath) {
  const existingPath = findUploadedFilePath(basePath);
  if (existingPath) {
    fs.unlinkSync(existingPath);
  }
}

async function uploadImageAndReturnUrl(file, targetBasePath, options = {}) {
  const extension = getUploadExtension(file);
  const relativePath = buildUploadRelativePath(targetBasePath, extension);
  const absolutePath = getUploadAbsolutePath(targetBasePath, extension);

  ensureDirectory(path.dirname(absolutePath));
  removeUploadedFile(targetBasePath);

  let transformer = sharp(file.path, { animated: true });

  if (options.resize) {
    transformer = transformer.resize(options.resize);
  }

  if (extension === ".jpg") {
    transformer = transformer.jpeg({ quality: options.quality || 92 });
  } else if (extension === ".png") {
    transformer = transformer.png({ quality: options.quality || 92 });
  } else if (extension === ".webp") {
    transformer = transformer.webp({ quality: options.quality || 92 });
  } else if (extension === ".gif") {
    transformer = transformer.gif();
  } else if (extension === ".avif") {
    transformer = transformer.avif({ quality: options.quality || 92 });
  } else if (extension === ".tiff") {
    transformer = transformer.tiff();
  }

  await transformer.toFile(absolutePath);

  return {
    path: absolutePath,
    url: getUploadUrlFromRelativePath(relativePath),
    extension,
  };
}

module.exports = {
  BRANDING_KEY,
  ensureDirectory,
  getUploadRoot,
  getUploadExtension,
  getUploadAbsolutePath,
  findUploadedFilePath,
  removeUploadedFile,
  getUploadUrlFromRelativePath,
  uploadImageAndReturnUrl,
};
