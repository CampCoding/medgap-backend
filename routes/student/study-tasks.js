const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/studyTasks");

// Backlog
router.post("/backlog", ctrl.createBacklog);
router.get("/backlog", ctrl.listBacklog);
router.put("/backlog/:backlog_task_id", ctrl.updateBacklog);
router.delete("/backlog/:backlog_task_id", ctrl.archiveBacklog);

// Calendar scheduling
router.post(
  "/calendar/from-backlog/:backlog_task_id",
  ctrl.scheduleFromBacklog
);
router.get("/calendar/day", ctrl.listDay); // ?date=YYYY-MM-DD
router.put("/calendar/:schedule_id/move", ctrl.moveSchedule);
router.delete("/calendar/:schedule_id", ctrl.unschedule);

module.exports = router;
