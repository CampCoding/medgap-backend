const { client } = require("../../config/db-connect");

async function listAllExams({
  page = 1,
  limit = 2000000,
  search = "",
  status,
  teacher_id,
  difficulty,
  free,
}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;

  let baseWhere = "WHERE 1 = 1";
  const params = [];

  if (search) {
    baseWhere += " AND (e.title LIKE ? OR e.instructions LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    baseWhere += " AND e.status = ?";
    params.push(status);
  }

  if (teacher_id) {
    baseWhere += " AND e.teacher_id = ?";
    params.push(teacher_id);
  }

  if (difficulty) {
    baseWhere += " AND e.difficulty = ?";
    params.push(difficulty);
  }

  if (typeof free !== "undefined" && free !== null && free !== "") {
    const freeValue =
      free === true || free === 1 || free === "1" || free === "true" ? 1 : 0;
    baseWhere += " AND e.free = ?";
    params.push(freeValue);
  }

  const listSql = `
    SELECT 
      e.*,
      u.unit_name AS subject_name,
      t.full_name AS teacher_name,
      COUNT(eq.question_id) AS question_count
    FROM exams e
    LEFT JOIN units u ON e.subject_id = u.unit_id
    LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
    LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
    ${baseWhere}
    GROUP BY e.exam_id
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(DISTINCT e.exam_id) AS total
    FROM exams e
    ${baseWhere}
  `;

  const [rows] = await client.execute(listSql, [...params, safeLimit, offset]);
  const [countRows] = await client.execute(countSql, params);

  const total = countRows?.[0]?.total || 0;

  return {
    exams: rows,
    pagination: {
      total,
      page: Math.max(parseInt(page, 10) || 1, 1),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

module.exports = {
  listAllExams,
};

