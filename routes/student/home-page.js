const express = require("express");
const router = express.Router();
const controller = require("../../controllers/student/homePage");

// Get complete home page data
router.get("/", controller.getHomePage);

// Get individual components
router.get("/quote", controller.getDailyQuote);
router.get("/streak", controller.getStudentStreak);
router.get("/today-activity", controller.getTodayActivity);
router.get("/daily-plan", controller.getDailyPlanProgress);
router.get("/continue-where-left-off", controller.getContinueWhereLeftOff);
router.get("/subject-performance", controller.getSubjectPerformance);
router.get("/weak-topics", controller.getWeakTopicsFocus);
router.get("/leaderboard", controller.getGroupLeaderboard);
router.get("/recent-activity", controller.getRecentActivity);
router.get("/my-activities", controller.getStudentRecentActivities);
router.get("/points", controller.getStudentPoints);

module.exports = router;
