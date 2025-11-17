const express = require("express");
const { requireAuth } = require("../../middlewares/jwt");
const { getAllExams } = require("../../controllers/admin/exams");

const router = express.Router();

router.get("/", requireAuth("admin"), getAllExams);

module.exports = router;

