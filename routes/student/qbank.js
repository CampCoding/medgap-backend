const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/qbank");

router.post("/questions/solve", ctrl.solveQuestion);
router.get("/:qbank_id/questions/list", ctrl.listQuestion);
router.post("/create", ctrl.createQbankController);
router.post("/category/create", ctrl.createCategory);
router.get("/category/list", ctrl.listCategories);
router.post("/category/assign/create", ctrl.assignToCategory);
router.post("/note/create", ctrl.createNote);
router.get("/note/list", ctrl.listNotes);
router.get("/qbank/list", ctrl.listQbank);
router.post("/deck/create", ctrl.createDeck);
router.put("/deck/update", ctrl.updateDeck);
router.delete("/deck/delete", ctrl.deleteDeck);
router.get("/deck/list", ctrl.listDecks);
router.post("/flashcard/create", ctrl.createFlashCard);
router.put("/flashcard/:student_flash_card_id/update", ctrl.updateFlashCard);
router.delete("/flashcard/:student_flash_card_id/delete", ctrl.deleteFlashCard);
router.get("/flashcard/due", ctrl.listDueFlashcards);
router.post("/flashcard/:student_flash_card_id/review", ctrl.reviewFlashcard);
router.get("/deck/:deck_id/flashcards", ctrl.listFlashcardsByDeck);
router.delete("/category/unassign/delete", ctrl.unAssignFromCategory);
router.delete("/note/delete", ctrl.deleteNote);

// Exam routes
router.get("/exams", ctrl.getStudentExams);
router.get("/exams/upcoming", ctrl.getUpcomingExams);
router.get("/exams/on-demand", ctrl.getOnDemandExams);
router.get("/exams/results", ctrl.getExamResults);
router.get("/exams/:examId/questions", ctrl.getExamQuestions);
router.post("/exams/:examId/start", ctrl.startExamAttempt);
router.post("/exams/answers/submit", ctrl.submitExamAnswer);
router.post("/exams/:attemptId/submit", ctrl.submitExamAttempt);
router.post("/exams/register", ctrl.registerExam);

module.exports = router;