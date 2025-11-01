const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Use disk storage
const uploadDir = path.resolve(process.cwd(), "uploads/questions");

// Create upload directory if it doesn't exist 
try {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Upload directory created/verified: ${uploadDir}`);
} catch (error) {
  console.warn("Could not create upload directory:", error.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const base = path
      .basename(file.originalname || "questions", ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

const allowed = new Set([
  "text/plain",
  "application/octet-stream" // Fallback for .txt files
]);

const fileFilter = (req, file, cb) => {
  console.log("FileFilter called:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    encoding: file.encoding
  });
  
  // Check file extension as well as mimetype
  const ext = path.extname(file.originalname || "").toLowerCase();
  const isValidExtension = ext === ".txt";
  const isValidMimeType = allowed.has(file.mimetype);
  const isValidField = file.fieldname === "questionsFile";
  
  console.log("FileFilter validation:", {
    ext,
    isValidExtension,
    isValidMimeType,
    isValidField,
    fieldname: file.fieldname,
    mimetype: file.mimetype
  });
  
  // Accept if extension is .txt OR mimetype is allowed
  // Also check field name matches
  if (!isValidField) {
    req.fileValidationError = `Invalid field name. Use 'questionsFile' as the field name. Received: '${file.fieldname}'`;
    console.error("FileFilter rejected: Invalid field name");
    return cb(null, false);
  }
  
  if (isValidExtension || isValidMimeType || !file.mimetype) {
    console.log("FileFilter: File accepted");
    cb(null, true);
  } else {
    req.fileValidationError = `Only .txt files are allowed. Received file: ${file.originalname || 'unknown'} with type: ${file.mimetype || 'unknown'}`;
    console.error("FileFilter rejected: Invalid file type");
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
