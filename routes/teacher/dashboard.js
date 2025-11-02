const express = require("express");
const router = express.Router();
const controller = require("../../controllers/teacher/dashboard");
const { requireAuth } = require("../../middlewares/jwt");

// Apply teacher authentication middleware to all routes
router.use(requireAuth("teacher"));

// Dashboard overview
router.get("/overview", controller.getDashboardOverview);

module.exports = router;

