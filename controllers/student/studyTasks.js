const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/studyTasks");
const getTokenFromHeader = require("../../utils/getToken");
const { verifyAccessToken } = require("../../utils/jwt");

function getStudentId(req, res) {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return null;
    const decoded = verifyAccessToken(token, "student");
    return decoded?.id || decoded?.student_id || decoded?.user?.student_id;
  } catch (err) {
    responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    return null;
  }
}

async function createBacklog(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { title, time, type, priority, notes } = req.body || {};
  if (!title || !time || !type || !priority) {
    return responseBuilder.badRequest(res, "Missing required fields");
  }
  const created = await repo.createBacklogTask({
    studentId,
    title,
    timeOfDay: time,
    taskType: String(type).toLowerCase(),
    priority: String(priority).toLowerCase(),
    notes: notes || null,
  });
  return responseBuilder.success(res, {
    data: created,
    message: "Task added to backlog",
  });
}

async function listBacklog(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const rows = await repo.listBacklogTasks({ studentId });
  return responseBuilder.success(res, {
    data: rows,
    message: "Backlog tasks retrieved successfully",
  });
}

async function updateBacklog(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { backlog_task_id } = req.params;
  const { title, time, type, priority, notes } = req.body || {};
  const ok = await repo.updateBacklogTask({
    backlogTaskId: Number(backlog_task_id),
    studentId,
    title,
    timeOfDay: time,
    taskType: type && String(type).toLowerCase(),
    priority: priority && String(priority).toLowerCase(),
    notes,
  });
  if (!ok) return responseBuilder.notFound(res, "Task not found");
  return responseBuilder.success(res, {
    data: { updated: true },
    message: "Task updated successfully",
  });
}

async function archiveBacklog(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { backlog_task_id } = req.params;
  const ok = await repo.archiveBacklogTask({
    backlogTaskId: Number(backlog_task_id),
    studentId,
  });
  if (!ok) return responseBuilder.notFound(res, "Task not found");
  return responseBuilder.success(res, {
    data: { archived: true },
    message: "Task archived successfully",
  });
}

async function scheduleFromBacklog(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { backlog_task_id } = req.params;
  const { date } = req.body || {};
  if (!date) {
    return responseBuilder.badRequest(res, "Date is required");
  }
  try {
    const created = await repo.scheduleTask({
      studentId,
      backlogTaskId: Number(backlog_task_id),
      scheduledDate: date,
    });
    return responseBuilder.success(res, {
      data: created,
      message: "Task scheduled",
    });
  } catch (error) {
    if (error.message === "Backlog task not found") {
      return responseBuilder.notFound(res, "Backlog task not found");
    }
    return responseBuilder.serverError(res, "Failed to schedule task");
  }
}

async function listDay(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { date } = req.query;
  if (!date)
    return responseBuilder.badRequest(res, "date is required (YYYY-MM-DD)");
  const rows = await repo.listDaySchedule({ studentId, scheduledDate: date });
  return responseBuilder.success(res, {
    data: rows,
    message: "Day schedule retrieved successfully",
  });
}

async function moveSchedule(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { schedule_id } = req.params;
  const { date } = req.body || {};
  if (!date) return responseBuilder.badRequest(res, "date is required");
  const ok = await repo.moveScheduledTask({
    scheduleId: Number(schedule_id),
    studentId,
    scheduledDate: date,
  });
  if (!ok) return responseBuilder.notFound(res, "Schedule not found");
  return responseBuilder.success(res, {
    data: { moved: true },
    message: "Schedule moved successfully",
  });
}

async function unschedule(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) return;
  const { schedule_id } = req.params;
  const ok = await repo.unscheduleTask({
    scheduleId: Number(schedule_id),
    studentId,
  });
  if (!ok) return responseBuilder.notFound(res, "Schedule not found");
  return responseBuilder.success(res, {
    data: { removed: true },
    message: "Schedule removed successfully",
  });
}

module.exports = {
  createBacklog,
  listBacklog,
  updateBacklog,
  archiveBacklog,
  scheduleFromBacklog,
  listDay,
  moveSchedule,
  unschedule,
};
