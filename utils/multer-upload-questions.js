const path = require("path");
const multer = require("multer");

// Use memory storage for better compatibility
const storage = multer.memoryStorage();

const allowed = new Set([
  "text/plain",
  "application/octet-stream" // Fallback for .txt files
]);

const fileFilter = (req, file, cb) => {
  // Check file extension as well as mimetype
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext === ".txt" || allowed.has(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = `Only .txt files are allowed. Received file: ${file.originalname || 'unknown'} with type: ${file.mimetype}`;
    cb(null, false);
  }
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

module.exports = { uploadQuestions: upload };
