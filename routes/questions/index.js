const express = require("express");
const router = express.Router();
const multer = require("multer");
const questionsController = require("../../controllers/questions/questions");
const {
  createQuestionValidation,
  updateQuestionValidation,
} = require("../../middlewares/validation/questions");
const jwtMiddleware = require("../../middlewares/jwt"); // Assuming JWT middleware is used for auth
const { uploadQuestions } = require("../../utils/multer-upload-questions");

// Get question statistics
router.get("/stats", questionsController.getQuestionsStats);

// Get available questions for selection
router.get("/available", questionsController.getAvailableQuestions);

// Search questions
router.get("/search", questionsController.searchQuestions);

// Get all questions with filters (Question Bank)
router.get("/", questionsController.getAllQuestions);

// Get question by ID
router.get("/:id", questionsController.getQuestionById);

// Get options for a specific question
router.get("/:id/options", questionsController.getQuestionOptions);

// Get question usage statistics
router.get("/:id/usage-stats", questionsController.getQuestionUsageStats);

// Upload questions from .txt file (Admin/Teacher only)
router.post(
  "/upload",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  (req, res, next) => {
    console.log("=== Upload Request Received ===");
    console.log("Headers:", {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    console.log("Body keys:", req.body ? Object.keys(req.body) : "Body not parsed yet");
    next();
  },
  uploadQuestions.single("questionsFile"),
  (err, req, res, next) => {
    // Multer error handler (must have 4 parameters: err, req, res, next)
    if (err) {
      console.error("Multer error occurred:", err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: "error",
            message: `File too large. Maximum size is 10MB.`
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            status: "error",
            message: `Unexpected file field. Use 'questionsFile' as the field name. Received: ${err.field}`
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            status: "error",
            message: `Too many files. Only one file is allowed.`
          });
        }
        return res.status(400).json({
          status: "error",
          message: `Upload error: ${err.message} (code: ${err.code})`
        });
      }
      // Non-multer errors
      return res.status(400).json({
        status: "error",
        message: `Upload error: ${err.message}`
      });
    }
    next();
  },
  (req, res, next) => {
    // Handle file validation errors from fileFilter
    console.log("After multer middleware:");
    console.log("req.file:", req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : null);
    console.log("req.fileValidationError:", req.fileValidationError || "none");
    console.log("req.body:", req.body || {});
    
    if (req.fileValidationError) {
      return res.status(400).json({
        status: "error",
        message: req.fileValidationError
      });
    }
    console.log(req.file)
    if (!req.file) {
      // Check if file content was sent as text field instead
      if (req.body && req.body.questionsFile && typeof req.body.questionsFile === 'string') {
        console.log("File sent as text field, will be handled by controller");
        // Let the controller handle it - it already has logic for this
        return next();
      }
      
      // Check if it's a multer rejection (file was sent but rejected)
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        // File was likely sent but rejected by fileFilter
        return res.status(400).json({
          status: "error",
          message: "File was rejected. Please ensure you're uploading a .txt file with the field name 'questionsFile'. " + (req.fileValidationError || "")
        });
      }
      return res.status(400).json({
        status: "error",
        message: "No file uploaded. Please use multipart/form-data and upload a .txt file with field name 'questionsFile'."
      });
    }
    
   
    next();
  },
  questionsController.uploadQuestionsFromFile
);

// Create a new question (Admin/Teacher only)
router.post(
  "/",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  createQuestionValidation,
  questionsController.createQuestion
);

// Create options for a question (Admin/Teacher only)
router.post(
  "/:id/options",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.createQuestionOptions
);

// Duplicate a question (Admin/Teacher only)
router.post(
  "/:id/duplicate",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.duplicateQuestion
);

// Update a question (Admin/Teacher only)
router.put(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  updateQuestionValidation,
  questionsController.updateQuestion
);

// Update question option (Admin/Teacher only)
router.put(
  "/:id/options/:optionId",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.updateQuestionOption
);

// Update question approval status (Admin only)
router.patch(
  "/:id/:status",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  questionsController.updateQuestionStatus
);

// Update question usage statistics
router.patch(
  "/:id/usage",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.updateQuestionUsage
);

// Delete a question (soft delete - Admin/Teacher only)
router.delete(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.deleteQuestion
);

// Delete question option (Admin/Teacher only)
router.delete(
  "/:id/options/:optionId",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  questionsController.deleteQuestionOption
);

// Permanently delete a question (Admin only)
router.delete(
  "/:id/permanent",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  questionsController.permanentDeleteQuestion
);

module.exports = router;
