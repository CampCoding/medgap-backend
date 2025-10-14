const express = require("express");
const router = express.Router();
const controller = require("../../controllers/teacher/exams");
const { requireAuth } = require("../../middlewares/jwt");
const {
  createExamValidation,
  updateExamValidation,
  addQuestionValidation,
  removeQuestionValidation
} = require("../../middlewares/validation/exams");

// Apply teacher authentication middleware to all routes
router.use(requireAuth("teacher"));

// Exam CRUD operations
router.get("/", controller.getAllExams);
router.get("/stats", controller.getExamStats);
router.get("/:id", controller.getExamById);
router.get("/:id/questions", controller.getExamQuestions);
router.get("/:id/attempts", controller.getExamAttempts);

// Create and update exams
router.post("/", controller.createExam);
router.put("/:id",  controller.updateExam);
router.patch("/:id/status", controller.updateExamStatus);

// Question management
router.post("/:id/questions", controller.addQuestionToExam);
router.put("/:id/questions/:questionId", controller.updateExamQuestion);
router.delete("/:id/questions/:questionId", controller.removeQuestionFromExam);

// Exam management
router.post("/:id/start", controller.startExam);
router.post("/:id/stop", controller.stopExam);
router.post("/:id/publish", controller.publishExam);
router.post("/:id/unpublish", controller.unpublishExam);

// Delete exams
router.delete("/:id", controller.deleteExam);
router.delete("/:id/permanent", controller.permanentDeleteExam);

module.exports = router;
