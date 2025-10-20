const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

let storage;

if (isServerless) {
  // Use memory storage for serverless environments
  storage = multer.memoryStorage();
} else {
  // Use disk storage for local development
  const uploadDir = path.resolve(process.cwd(), "uploads/flashcards");
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (error) {
    console.warn("Could not create upload directory:", error.message);
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || "") || "").toLowerCase();
      const base = path
        .basename(file.originalname || "flashcards", ext)
        .replace(/[^a-z0-9-_]+/gi, "_")
        .toLowerCase();
      cb(null, `${base}-${Date.now()}${ext}`);
    }
  });
}

const allowed = new Set([
  "text/plain",
  "application/octet-stream" // Fallback for .txt files
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
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased for larger files)
    files: 1, // Only one file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
    fieldNameSize: 100, // Field name size limit
    fields: 10 // Maximum number of fields
  }
});

module.exports = { uploadFlashcards: upload };
