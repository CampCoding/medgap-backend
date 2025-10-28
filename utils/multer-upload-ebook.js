const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.resolve(process.cwd(), "uploads/ebooks");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const base = path
      .basename(file.originalname || "ebook", ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

const allowedMimes = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/epub+zip",
  "application/zip", // some clients send epub as zip
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/octet-stream" // generic
]);
const allowedExts = new Set([".pdf", ".epub", ".jpg", ".jpeg", ".png"]);

const fileFilter = (req, file, cb) => {
  const field = String(file.fieldname || "");
  const mimetype = String(file.mimetype || "").toLowerCase();
  const ext = (path.extname(file.originalname || "") || "").toLowerCase();

  // Only allow these fields for files
  const allowedFields = new Set(["file", "thumbnail"]);
  if (!allowedFields.has(field)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", field));
  }

  // Accept if MIME is allowed OR extension is allowed
  if (allowedMimes.has(mimetype) || allowedExts.has(ext)) return cb(null, true);

  // Relaxed behavior: accept but warn so uploads aren't blocked by odd client headers
  console.warn(`[upload][ebooks] Unrecognized type, accepting: field=${field} name=${file.originalname} type=${mimetype}`);
  req._fileTypeWarning = true;
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2
  }
});

module.exports = { uploadEbook: upload };
