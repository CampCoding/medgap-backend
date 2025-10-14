const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/studyPlans");

router.get("/modules", ctrl.getModules);
router.get("/modules/:module_id/topics", ctrl.getTopicsByModule);
router.get("/subjects/:module_id/topics", ctrl.getTopicsBySubject);
router.get("/modules/:module_id/subjects", ctrl.getSubjectsByModule);
// Study Plans CRUD
router.post("/", ctrl.createPlan);
router.get("/", ctrl.getPlans);
router.get("/:plan_id", ctrl.getPlan);
router.put("/:plan_id", ctrl.updatePlan);
router.delete("/:plan_id", ctrl.deletePlan);

router.post("/:plan_id/content", ctrl.addContent);
router.get("/:plan_id/content", ctrl.getContent);
router.delete("/:plan_id/content/:content_id", ctrl.removeContent);

// Session Management
router.post("/:plan_id/sessions/generate", ctrl.generateSessions);
router.get("/:plan_id/sessions", ctrl.getSessions);
router.put("/:plan_id/sessions/:session_id", ctrl.updateSessionProgress);
router.get("/:plan_id/sessions/:session_id/details", ctrl.getSessionDetails);
router.post("/:plan_id/sessions/:session_id/questions/:question_id/solve", ctrl.solveSessionQuestion);
router.post("/:plan_id/sessions/:session_id/flashcards/:flashcard_id/review", ctrl.reviewSessionFlashcard);

// Today overview
router.get("/today/overview", ctrl.getToday);

// Dashboard overview (study-dash)
router.get("/dash/overview", ctrl.getDashboard);

module.exports = router;
