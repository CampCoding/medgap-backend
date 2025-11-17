const express = require("express");
const { requireAuth } = require("../../middlewares/jwt");
const {
  setBookFree,
  setTopicFree,
  setExamFree,
} = require("../../controllers/freeAccess");

const router = express.Router();

router.patch("/books/:id/free", requireAuth("admin"), setBookFree);
router.patch("/topics/:id/free", requireAuth("admin"), setTopicFree);
router.patch("/exams/:id/free", requireAuth("admin"), setExamFree);

module.exports = router;

