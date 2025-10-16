const express = require("express");
const router = express.Router();
const topicsController = require("../../controllers/topics/topics");
const {
  createTopicValidation,
  updateTopicValidation
} = require("../../middlewares/validation/topics");
const jwtMiddleware = require("../../middlewares/jwt"); // Assuming JWT middleware is used for auth
const { verifyAccessToken } = require("../../utils/jwt");
const getTokenFromHeader = require("../../utils/getToken");

// Get topics statistics
router.get("/stats", topicsController.getTopicsStats);

// Get available topics for selection
router.get("/available", topicsController.getAvailableTopics);

// Search topics
router.get("/search", topicsController.searchTopics);

// Get all topics with filters
router.get("/", (req, res) => {
  if (!req?.query?.teacher_id) {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "teacher");
    req.user = decoded;
  } else {
    req.user = {
      user: {
        teacher_id: req?.query?.teacher_id
      }
    };
  }
  
  topicsController.getAllTopics(req, res);
});

router.get("/all", (req, res) => {
   topicsController.getAllTopics(req, res);
});


// Get topic by ID
router.get("/:id", (req, res) => {
  if (!req?.query?.teacher_id) {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "teacher");
    req.user = decoded?.user;
  } else {
    req.user = {
      teacher_id: req?.query?.teacher_id
    };
  }
  topicsController.getTopicById(req, res);
});

// Get questions for a specific topic
router.get("/:id/questions", topicsController.getTopicQuestions);

// Get flashcards for a specific topic
router.get("/:id/flashcards", topicsController.getTopicFlashcards);

// Get digital library files for a specific topic
router.get("/:id/library", topicsController.getTopicLibraryFiles);

// Create a new topic (Admin only)
router.post(
  "/",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  async (req, res) => {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "teacher");
    req.user = decoded;

    await topicsController.createTopic(req, res);
  }
);

// Duplicate a topic (Admin only)
router.post(
  "/:id/duplicate",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  topicsController.duplicateTopic
);

// Update a topic (Admin only)
router.put(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  updateTopicValidation,
  topicsController.updateTopic
);

// Soft delete a topic (Admin only)
router.delete(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  topicsController.deleteTopic
);

// Permanently delete a topic (Admin only)
router.delete(
  "/:id/permanent",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  topicsController.permanentDeleteTopic
);

module.exports = router;
