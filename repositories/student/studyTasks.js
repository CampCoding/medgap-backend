const { client } = require("../../config/db-connect");

// Backlog Repos
async function createBacklogTask({
  studentId,
  title,
  timeOfDay,
  durationMinutes,
  taskType,
  priority,
  notes,
}) {
  const sql = `INSERT INTO student_tasks_backlog (student_id, title, time_of_day, task_type, priority, notes)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    studentId,
    title,
    timeOfDay,
    taskType,
    priority,
    notes || null,
  ];
  const [result] = await client.execute(sql, params);
  return { backlog_task_id: result.insertId };
}

async function listBacklogTasks({ studentId }) {
  const sql = `SELECT * FROM student_tasks_backlog WHERE student_id = ? AND status = 'backlog' ORDER BY created_at DESC`;
  const [rows] = await client.execute(sql, [studentId]);
  return rows;
}

async function updateBacklogTask({
  backlogTaskId,
  studentId,
  title,
  timeOfDay,
  durationMinutes,
  taskType,
  priority,
  notes,
}) {
  const sql = `UPDATE student_tasks_backlog
               SET title = COALESCE(?, title),
                   time_of_day = COALESCE(?, time_of_day),
                   task_type = COALESCE(?, task_type),
                   priority = COALESCE(?, priority),
                   notes = COALESCE(?, notes)
               WHERE backlog_task_id = ? AND student_id = ?`;
  const params = [
    title || null,
    timeOfDay || null,
    taskType || null,
    priority || null,
    notes || null,
    backlogTaskId,
    studentId,
  ];
  const [result] = await client.execute(sql, params);
  return result.affectedRows > 0;
}

async function archiveBacklogTask({ backlogTaskId, studentId }) {
  const sql = `UPDATE student_tasks_backlog SET status = 'archived' WHERE backlog_task_id = ? AND student_id = ?`;
  const [result] = await client.execute(sql, [backlogTaskId, studentId]);
  return result.affectedRows > 0;
}

// Schedule Repos
async function scheduleTask({ studentId, backlogTaskId, scheduledDate }) {
  // First get the task details from backlog
  const [backlogTask] = await client.execute(
    "SELECT time_of_day FROM student_tasks_backlog WHERE backlog_task_id = ? AND student_id = ?",
    [backlogTaskId, studentId]
  );

  if (!backlogTask || backlogTask.length === 0) {
    throw new Error("Backlog task not found");
  }

  const sql = `INSERT INTO student_task_schedule (student_id, backlog_task_id, scheduled_date, start_time)
               VALUES (?, ?, ?, ?)`;
  const params = [
    studentId,
    backlogTaskId,
    scheduledDate,
    backlogTask[0].time_of_day,
  ];
  const [result] = await client.execute(sql, params);
  return { schedule_id: result.insertId };
}

async function listDaySchedule({ studentId, scheduledDate }) {
  const sql = `SELECT s.*, b.title, b.task_type, b.priority
               FROM student_task_schedule s
               LEFT JOIN student_tasks_backlog b ON b.backlog_task_id = s.backlog_task_id
               WHERE s.student_id = ? AND s.scheduled_date = ?
               ORDER BY s.start_time ASC`;
  const [rows] = await client.execute(sql, [studentId, scheduledDate]);
  return rows;
}

async function moveScheduledTask({ scheduleId, studentId, scheduledDate }) {
  // Get the original start_time from the backlog task
  const [scheduleData] = await client.execute(
    `SELECT s.backlog_task_id, b.time_of_day 
     FROM student_task_schedule s 
     LEFT JOIN student_tasks_backlog b ON b.backlog_task_id = s.backlog_task_id 
     WHERE s.schedule_id = ? AND s.student_id = ?`,
    [scheduleId, studentId]
  );

  if (!scheduleData || scheduleData.length === 0) {
    return false;
  }

  const sql = `UPDATE student_task_schedule SET scheduled_date = ? WHERE schedule_id = ? AND student_id = ?`;
  const [result] = await client.execute(sql, [
    scheduledDate,
    scheduleId,
    studentId,
  ]);
  return result.affectedRows > 0;
}

async function unscheduleTask({ scheduleId, studentId }) {
  const sql = `DELETE FROM student_task_schedule WHERE schedule_id = ? AND student_id = ?`;
  const [result] = await client.execute(sql, [scheduleId, studentId]);
  return result.affectedRows > 0;
}

module.exports = {
  createBacklogTask,
  listBacklogTasks,
  updateBacklogTask,
  archiveBacklogTask,
  scheduleTask,
  listDaySchedule,
  moveScheduledTask,
  unscheduleTask,
};
