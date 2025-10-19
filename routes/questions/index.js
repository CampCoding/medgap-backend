const express = require("express");
const router = express.Router();
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
  uploadQuestions.single("questionsFile"),
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
