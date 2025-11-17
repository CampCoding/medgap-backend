const express = require("express");
const { requireAuth } = require("../../middlewares/jwt");
const {
  setBookFree,
  setTopicFree,
  setExamFree,
} = require("../../controllers/freeAccess");

const router = express.Router();

router.patch("/books/:id/free", requireAuth("teacher"), setBookFree);
router.patch("/topics/:id/free", requireAuth("teacher"), setTopicFree);
router.patch("/exams/:id/free", requireAuth("teacher"), setExamFree);

module.exports = router;

