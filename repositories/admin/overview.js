const { client } = require("../../config/db-connect");

async function getOverview() {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM teachers) AS teachers,
      (SELECT COUNT(*) FROM teachers WHERE status = 'approved') AS Active_teachers,
      (SELECT COUNT(*) FROM students) AS students,
      (SELECT COUNT(*) FROM modules) AS modules,
      (SELECT COUNT(*) FROM modules WHERE status = 'active') AS Active_modules,
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(*) FROM exams) AS active_exams
  `;
  const [rows] = await client.execute(sql);
  return rows && rows[0] ? rows[0] : { teachers: 0, students: 0, questions: 0, active_exams: 0 };
}

async function getRecentActivity() {
  const activity = [];
  const [t] = await client.execute(
    `SELECT 'New teacher registered' AS title, full_name AS details, created_at AS at FROM teachers ORDER BY created_at DESC LIMIT 5`
  );
  const [q] = await client.execute(
    `SELECT 'New question added' AS title, LEFT(question_text, 60) AS details, created_at AS at FROM questions ORDER BY created_at DESC LIMIT 5`
  );
  const [e] = await client.execute(
    `SELECT 'Exam created' AS title, title AS details, created_at AS at FROM exams ORDER BY created_at DESC LIMIT 5`
  );
  return [...t, ...q, ...e]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5)
    .map((r) => ({ title: r.title, details: r.details, at: r.at }));
}

module.exports = { getOverview, getRecentActivity };


