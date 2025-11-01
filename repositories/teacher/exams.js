const { client } = require("../../config/db-connect");

// Check if we're using MySQL (development) or PostgreSQL (production)
const isMysql = true;

// Get all exams for a specific teacher with pagination and filters
async function getAllExams({
  teacherId,
  offset = 0,
  limit = 20,
  search = "",
  subject = "",
  status = "",
  difficulty = "",
}) {
  let sql = `
    SELECT 
      e.*,
      u.unit_name as subject_name,
      COUNT(eq.question_id) as question_count
    FROM exams e
    LEFT JOIN units u ON e.subject_id = u.unit_id
    LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
    WHERE e.teacher_id = ?
  `;

  let params = [teacherId];
console.log("teacherId", teacherId)
  if (search) {
    sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (subject) {
    sql += ` AND e.subject_id = ?`;
    params.push(subject);
  }

  if (status) {
    sql += ` AND e.status = ?`;
    params.push(status);
  }

  if (difficulty) {
    sql += ` AND e.difficulty = ?`;
    params.push(difficulty);
  }

  sql += ` GROUP BY e.exam_id ORDER BY e.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  console.log("Get teacher exams SQL:", sql, params);
  const [rows] = isMysql
    ? await client.execute(sql, params)
    : await client.query(sql, params);

  // Get total count for pagination
  let countSql = `SELECT COUNT(DISTINCT e.exam_id) as total FROM exams e WHERE e.teacher_id = ?`;
  let countParams = [teacherId];

  if (search) {
    countSql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
    countParams.push(`%${search}%`, `%${search}%`);
  }

  if (subject) {
    countSql += ` AND e.subject_id = ?`;
    countParams.push(subject);
  }

  if (status) {
    countSql += ` AND e.status = ?`;
    countParams.push(status);
  }

  if (difficulty) {
    countSql += ` AND e.difficulty = ?`;
    countParams.push(difficulty);
  }

  const [countResult] = isMysql
    ? await client.execute(countSql, countParams)
    : await client.query(countSql, countParams);
  const total = countResult[0].total;

  return {
    exams: rows,
    pagination: {
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Get exam statistics for a specific teacher
async function getExamStats(teacherId) {
  const sql = `
    SELECT 
      COUNT(*) as total_exams,
      COUNT(CASE WHEN status = 'published' THEN 1 END) as published_exams,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_exams,
      COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_exams,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_exams,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_exams,
      AVG(duration) as avg_duration
    FROM exams
    WHERE teacher_id = ?
  `;

  const [rows] = isMysql ? await client.execute(sql, [teacherId]) : await client.query(sql, [teacherId]);
  return rows[0];
}

// Get exam by ID (only if owned by teacher)
async function getExamById(examId, teacherId) {
  const sql = `
    SELECT 
      e.*,
      u.unit_name as subject_name,
      COUNT(eq.question_id) as question_count
    FROM exams e
    LEFT JOIN units u ON e.subject_id = u.unit_id
    LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
    WHERE e.exam_id = ? AND e.teacher_id = ?
    GROUP BY e.exam_id
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [examId, teacherId])
    : await client.query(sql, [examId, teacherId]);
  return rows.length > 0 ? rows[0] : null;
}

// Get exam questions (only if owned by teacher)
async function getExamQuestions(examId, teacherId) {
  const sql = `
    SELECT 
      eq.*,
      q.question_text,
      q.question_type,
      q.difficulty_level as question_difficulty,
      q.points as default_points,
      t.topic_name as topic_name,
      u.unit_name as subject_name
    FROM exam_questions eq
    JOIN questions q ON eq.question_id = q.question_id
    JOIN topics t ON q.topic_id = t.topic_id
    JOIN units u ON t.unit_id = u.unit_id
    JOIN exams e ON eq.exam_id = e.exam_id
    WHERE eq.exam_id = ? AND e.teacher_id = ?
    ORDER BY eq.order_index
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [examId, teacherId])
    : await client.query(sql, [examId, teacherId]);
  return rows;
}

// Get exam attempts (only if owned by teacher)
async function getExamAttempts(examId, teacherId, { offset = 0, limit = 20 }) {
  const sql = `
    SELECT 
      ea.*,
      e.title as exam_title
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.exam_id
    WHERE ea.exam_id = ? AND e.teacher_id = ?
    ORDER BY ea.started_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [examId, teacherId, limit, offset])
    : await client.query(sql, [examId, teacherId, limit, offset]);

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total 
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.exam_id
    WHERE ea.exam_id = ? AND e.teacher_id = ?
  `;
  const [countResult] = isMysql
    ? await client.execute(countSql, [examId, teacherId])
    : await client.query(countSql, [examId, teacherId]);
  const total = countResult[0].total;

  return {
    attempts: rows,
    pagination: {
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Create new exam
async function createExam(examData) {
  const {
    title,
    subject_id, // Column name is subject_id but references units.unit_id
    teacher_id,
    difficulty,
    duration,
    instructions,
    settings,
    start_date = null, 
    end_date = null,
    scheduled_date = null,
    created_by,
    question_ids = [], // Array of question IDs to add to exam
  } = examData;

  const sql = `
    INSERT INTO exams (
      title, subject_id, teacher_id, difficulty, duration, instructions, settings, created_by,
      start_date, end_date, scheduled_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = isMysql
    ? await client.execute(sql, [
        title,
        subject_id,
        teacher_id,
        difficulty,
        duration,
        instructions,
        settings,
        created_by,
        start_date || null,
        end_date || null,
        scheduled_date || null,
      ])
    : await client.query(sql, [
        title,
        subject_id,
        teacher_id,
        difficulty,
        duration,
        instructions,
        settings,
        created_by,
        start_date || null,
        end_date || null,
        scheduled_date || null,
      ]);

  // Get the auto-generated exam ID
  const examId = result.insertId;

  // Add questions to exam if provided
  if (question_ids && question_ids.length > 0) {
    await addQuestionsToExam(examId, question_ids);
  }

  // Return the created exam
  return await getExamById(examId, teacher_id);
}

// Update exam (only if owned by teacher)
async function updateExam(updateData) {
  const {
    examId,
    teacherId,
    title,
    subject_id,
    difficulty,
    duration,
    instructions,
    settings,
    total_points,
    passing_score,
    updated_by,
  } = updateData;

  // Build dynamic SQL
  const fields = [];
  const values = [];

  if (title !== undefined) {
    fields.push("title = ?");
    values.push(title);
  }
  if (subject_id !== undefined) {
    fields.push("subject_id = ?");
    values.push(subject_id);
  }
  if (difficulty !== undefined) {
    fields.push("difficulty = ?");
    values.push(difficulty);
  }
  if (duration !== undefined) {
    fields.push("duration = ?");
    values.push(duration);
  }
  if (total_points !== undefined) {
    fields.push("total_points = ?");
    values.push(total_points);
  }
  if (passing_score !== undefined) {
    fields.push("passing_score = ?");
    values.push(passing_score);
  }

  if (instructions !== undefined) {
    fields.push("instructions = ?");
    values.push(instructions);
  }
  if (settings !== undefined) {
    fields.push("settings = ?");
    values.push(settings);
  }

  if (fields.length === 0) {
    return false; // No fields to update
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(examId, teacherId);

  const sql = `UPDATE exams SET ${fields.join(", ")} WHERE exam_id = ? AND teacher_id = ?`;

  const [result] = isMysql
    ? await client.execute(sql, values)
    : await client.query(sql, values);
  // In mysql2: affectedRows counts matched rows; changedRows counts actually changed rows
  // In pg: rowCount indicates affected rows
  if (isMysql) {
    const changed = (result && typeof result.changedRows === 'number') ? result.changedRows : result?.affectedRows;
    return changed > 0;
  }
  return (result && typeof result.rowCount === 'number') ? result.rowCount > 0 : false;
}

// Update exam status (only if owned by teacher)
async function updateExamStatus(examId, status, teacherId) {
  const sql = `UPDATE exams SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE exam_id = ? AND teacher_id = ?`;

  const [result] = isMysql
    ? await client.execute(sql, [status, examId, teacherId])
    : await client.query(sql, [status, examId, teacherId]);

  return result.affectedRows > 0;
}

// Add question to exam (only if owned by teacher)
async function addQuestionToExam({ examId, teacherId, questionId, orderIndex, points, timeLimit }) {
  // First verify the exam belongs to the teacher
  const examCheck = await getExamById(examId, teacherId);
  if (!examCheck) {
    throw new Error("Exam not found or access denied");
  }

  const sql = `
    INSERT INTO exam_questions (exam_id, question_id, order_index, points, time_limit)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      order_index = VALUES(order_index),
      points = VALUES(points),
      time_limit = VALUES(time_limit)
  `;

  const [result] = isMysql
    ? await client.execute(sql, [examId, questionId, orderIndex, points, timeLimit])
    : await client.query(sql, [examId, questionId, orderIndex, points, timeLimit]);

  return {
    exam_id: examId,
    question_id: questionId,
    order_index: orderIndex,
    points,
    time_limit: timeLimit,
  };
}

// Update exam question (only if owned by teacher)
async function updateExamQuestion(updateData) {
  const { examId, teacherId, questionId, orderIndex, points, timeLimit } = updateData;

  // First verify the exam belongs to the teacher
  const examCheck = await getExamById(examId, teacherId);
  if (!examCheck) {
    return false;
  }

  // Build dynamic SQL
  const fields = [];
  const values = [];

  if (orderIndex !== undefined) {
    fields.push("order_index = ?");
    values.push(orderIndex);
  }
  if (points !== undefined) {
    fields.push("points = ?");
    values.push(points);
  }
  if (timeLimit !== undefined) {
    fields.push("time_limit = ?");
    values.push(timeLimit);
  }

  if (fields.length === 0) {
    return false; // No fields to update
  }

  values.push(examId, questionId);

  const sql = `UPDATE exam_questions SET ${fields.join(", ")} WHERE exam_id = ? AND question_id = ?`;

  const [result] = isMysql
    ? await client.execute(sql, values)
    : await client.query(sql, values);

  return result.affectedRows > 0;
}

// Remove question from exam (only if owned by teacher)
async function removeQuestionFromExam(examId, questionId, teacherId) {
  // First verify the exam belongs to the teacher
  const examCheck = await getExamById(examId, teacherId);
  if (!examCheck) {
    return false;
  }

  const sql = `DELETE FROM exam_questions WHERE exam_id = ? AND question_id = ?`;

  const [result] = isMysql
    ? await client.execute(sql, [examId, questionId])
    : await client.query(sql, [examId, questionId]);

  return result.affectedRows > 0;
}

// Start exam (only if owned by teacher)
async function startExam(examId, scheduledDate, teacherId) {
  const sql = `
    UPDATE exams 
    SET status = 'scheduled', 
        scheduled_date = ?,
        updated_at = CURRENT_TIMESTAMP 
    WHERE exam_id = ? AND teacher_id = ? AND status = 'draft'
  `;

  const [result] = isMysql
    ? await client.execute(sql, [scheduledDate, examId, teacherId])
    : await client.query(sql, [scheduledDate, examId, teacherId]);

  return result.affectedRows > 0;
}

// Stop exam (only if owned by teacher)
async function stopExam(examId, teacherId) {
  const sql = `
    UPDATE exams 
    SET status = 'completed', 
        end_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP 
    WHERE exam_id = ? AND teacher_id = ? AND status IN ('published', 'scheduled')
  `;

  const [result] = isMysql
    ? await client.execute(sql, [examId, teacherId])
    : await client.query(sql, [examId, teacherId]);

  return result.affectedRows > 0;
}

// Publish exam (only if owned by teacher)
async function publishExam(examId, teacherId) {
  const sql = `
    UPDATE exams 
    SET status = 'published', 
        start_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP 
    WHERE exam_id = ? AND teacher_id = ? AND status = 'draft'
  `;

  const [result] = isMysql
    ? await client.execute(sql, [examId, teacherId])
    : await client.query(sql, [examId, teacherId]);

  return result.affectedRows > 0;
}

// Unpublish exam (only if owned by teacher)
async function unpublishExam(examId, teacherId) {
  const sql = `
    UPDATE exams 
    SET status = 'draft', 
        start_date = NULL,
        updated_at = CURRENT_TIMESTAMP 
    WHERE exam_id = ? AND teacher_id = ? AND status = 'published'
  `;

  const [result] = isMysql
    ? await client.execute(sql, [examId, teacherId])
    : await client.query(sql, [examId, teacherId]);

  return result.affectedRows > 0;
}

// Delete exam (only if owned by teacher)
async function deleteExam(examId, teacherId) {
await permanentDeleteExam(examId, teacherId)
}

// Permanent delete exam (only if owned by teacher)
async function permanentDeleteExam(examId, teacherId) {
  // First verify the exam belongs to the teacher
  const examCheck = await getExamById(examId, teacherId);
  if (!examCheck) {
    return false;
  }


  await client.execute("DELETE FROM exam_questions WHERE exam_id = ?", [examId]);
  
  // Then delete the exam
  const sql = `DELETE FROM exams WHERE exam_id = ?`;
  const [result] = isMysql
    ? await client.execute(sql, [examId])
    : await client.query(sql, [examId]);

  return result.affectedRows > 0;
}

// Add multiple questions to exam
async function addQuestionsToExam(examId, questionIds) {
  if (!questionIds || questionIds.length === 0) return;

  const values = questionIds.map((questionId, index) => [
    examId,
    questionId,
    index + 1, // order_index
    1 // default points
  ]);

  const sql = `
    INSERT INTO exam_questions (exam_id, question_id, order_index, points)
    VALUES ${values.map(() => '(?, ?, ?, ?)').join(', ')}
  `;

  const flatValues = values.flat();

  const [result] = isMysql
    ? await client.execute(sql, flatValues)
    : await client.query(sql, flatValues);

  return result;
}

module.exports = {
  getAllExams,
  getExamStats,
  getExamById,
  getExamQuestions,
  getExamAttempts,
  createExam,
  updateExam,
  updateExamStatus,
  addQuestionToExam,
  addQuestionsToExam,
  updateExamQuestion,
  removeQuestionFromExam,
  startExam,
  stopExam,
  publishExam,
  unpublishExam,
  deleteExam,
  permanentDeleteExam,
};
