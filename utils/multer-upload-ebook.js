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

const allowed = new Set([
  "application/pdf",
  "application/epub+zip",
  "image/jpeg",
  "image/png"
]);

const fileFilter = (req, file, cb) => {
  if (!allowed.has(file.mimetype)) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Unsupported file type: ${file.mimetype}`
      )
    );
  }
  cb(null, true);
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
