const { client } = require("../../config/db-connect");

async function listLibrariesByModule({
  moduleId,
  studentId,
  page = 1,
  limit = 12,
  search = "",
}) {
  const where = ["fl.status = 'active'", "fl.module_id = ?"];
  const params = [moduleId];
  if (search && search.trim()) {
    where.push("(fl.library_name LIKE ? OR fl.description LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  const sql = `
    SELECT fl.library_id, fl.library_name, fl.description, fl.difficulty_level,
           fl.estimated_time, fl.created_at,
           COUNT(f.flashcard_id) AS total_cards,
           COALESCE(slp.studied_count, 0) AS studied_count,
           COALESCE(slp.correct_count, 0) AS correct_count,
           COALESCE(slp.time_spent, 0) AS time_spent,
           COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE ${where.join(" AND ")}
    GROUP BY fl.library_id
    ORDER BY fl.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM flashcard_libraries fl
    WHERE ${where.join(" AND ")}
  `;
  const [rows] = await client.execute(sql, [
    studentId,
    ...params,
    limit,
    offset,
  ]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;
  return {
    data: rows.map((r) => ({
      library_id: r.library_id,
      name: r.library_name,
      desc: r.description,
      difficulty: r.difficulty_level,
      estimated_time: r.estimated_time,
      created_at: r.created_at,
      total_cards: Number(r.total_cards) || 0,
      studied_count: Number(r.studied_count) || 0,
      correct_count: Number(r.correct_count) || 0,
      time_spent: Number(r.time_spent) || 0,
      progress_status: r.progress_status,
      progress_percent: Number(r.total_cards)
        ? Math.round((Number(r.studied_count) / Number(r.total_cards)) * 100)
        : 0,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
async function listLibrariesByBulkModules({
  moduleId,
  studentId,
  page = 1,
  limit = 1200,
  search = "",
}) {
  // Normalize moduleId to array
  let moduleIds = moduleId;
  if (!Array.isArray(moduleIds)) {
    if (typeof moduleIds === "string") {
      moduleIds = moduleIds.split(",").map((x) => x.trim()).filter(Boolean);
    } else if (moduleIds != null) {
      moduleIds = [moduleIds];
    } else {
      moduleIds = [];
    }
  }

  // if (moduleIds.length === 0) {
  //   // No modules → nothing to fetch
  //   return {
  //     data: [],
  //     page,
  //     limit,
  //     total: 0,
  //     totalPages: 0,
  //   };
  // }
  console.log(moduleIds)

  const placeholders = moduleIds.map(() => "?").join(",");
  const whereClauses = ["fl.status = 'active'", `fl.module_id IN (${placeholders})`];
  const paramsForWhere = [...moduleIds];

  if (search && search.trim()) {
    whereClauses.push("(fl.library_name LIKE ? OR fl.description LIKE ?)");
    paramsForWhere.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  const sql = `
    SELECT 
      fl.library_id, 
      fl.library_name, 
      fl.description, 
      fl.difficulty_level,
      fl.estimated_time, 
      fl.created_at,
      COUNT(f.flashcard_id) AS total_cards,
      COALESCE(slp.studied_count, 0) AS studied_count,
      COALESCE(slp.correct_count, 0) AS correct_count,
      COALESCE(slp.time_spent, 0) AS time_spent,
      COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY fl.library_id
    ORDER BY fl.created_at DESC
    LIMIT ? OFFSET ?;
  `;


  // Parameters must match the '?' positions in SQL:
  // 1st param = studentId (for the JOIN)
  // then moduleIds and optional search
  // then limit, offset
  const sqlParams = [studentId, ...paramsForWhere, limit, offset];

  // Debug log: to inspect final SQL and params
  console.log("listLibrariesByBulkModules: SQL:", sql);
  console.log("listLibrariesByBulkModules: params:", sqlParams);

  const [rows] = await client.execute(sql, sqlParams);

  // Count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM flashcard_libraries fl
    WHERE ${whereClauses.join(" AND ")};
  `;
  const [countRows] = await client.execute(countSql, paramsForWhere);
  const total = countRows?.[0]?.total ?? 0;

  const data = rows.map((r) => {
    const tc = Number(r.total_cards) || 0;
    const sc = Number(r.studied_count) || 0;
    return {
      library_id: r.library_id,
      name: r.library_name,
      desc: r.description,
      difficulty: r.difficulty_level,
      estimated_time: r.estimated_time,
      created_at: r.created_at,
      total_cards: tc,
      studied_count: sc,
      correct_count: Number(r.correct_count) || 0,
      time_spent: Number(r.time_spent) || 0,
      progress_status: r.progress_status,
      progress_percent: tc > 0 ? Math.round((sc / tc) * 100) : 0,
    };
  });

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}


async function getLibraryWithCards({ libraryId, studentId }) {
  const libSql = `
    SELECT fl.*, COUNT(f.flashcard_id) AS total_cards,
           COALESCE(slp.studied_count, 0) AS studied_count,
           COALESCE(slp.correct_count, 0) AS correct_count,
           COALESCE(slp.time_spent, 0) AS time_spent,
           COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE fl.library_id = ?
    GROUP BY fl.library_id
  `;
  const [libRows] = await client.execute(libSql, [studentId, libraryId]);
  if (!libRows.length) return null;
  const lib = libRows[0];

  const cardsSql = `
    SELECT f.flashcard_id, f.front_text, f.back_text, f.difficulty_level, f.card_order,
           COALESCE(cp.attempts, 0) AS attempts,
           COALESCE(cp.correct, 0) AS correct,
           COALESCE(cp.status, 'new') AS card_status,
           cp.last_seen
    FROM flashcards f
    LEFT JOIN student_flashcard_card_progress cp
      ON cp.flashcard_id = f.flashcard_id AND cp.student_id = ?
    WHERE f.library_id = ? AND f.status IN ('active','draft')
    ORDER BY f.card_order, f.flashcard_id
  `;
  const [cardRows] = await client.execute(cardsSql, [studentId, libraryId]);

  return {
    library: {
      library_id: lib.library_id,
      name: lib.library_name,
      desc: lib.description,
      difficulty: lib.difficulty_level,
      estimated_time: lib.estimated_time,
      created_at: lib.created_at,
      total_cards: Number(lib.total_cards) || 0,
      studied_count: Number(lib.studied_count) || 0,
      correct_count: Number(lib.correct_count) || 0,
      time_spent: Number(lib.time_spent) || 0,
      progress_status: lib.progress_status,
      progress_percent: Number(lib.total_cards)
        ? Math.round(
            (Number(lib.studied_count) / Number(lib.total_cards)) * 100
          )
        : 0,
    },
    cards: cardRows,
  };
}

async function upsertLibraryProgress({
  studentId,
  libraryId,
  studiedCount,
  correctCount,
  timeSpent,
  status,
}) {
  const sql = `
    INSERT INTO student_flashcard_library_progress (student_id, library_id, studied_count, correct_count, time_spent, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      studied_count = VALUES(studied_count),
      correct_count = VALUES(correct_count),
      time_spent = VALUES(time_spent),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP
  `;
  await client.execute(sql, [
    studentId,
    libraryId,
    studiedCount,
    correctCount,
    timeSpent,
    status,
  ]);
  return true;
}

async function upsertCardProgress({
  studentId,
  flashcardId,
  attempts,
  correct,
  status,
}) {
  const sql = `
    INSERT INTO student_flashcard_card_progress (student_id, flashcard_id, attempts, correct, status, last_seen)
    VALUES (?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      attempts = attempts + VALUES(attempts),
      correct = correct + VALUES(correct),
      status = VALUES(status),
      last_seen = NOW()
  `;
  await client.execute(sql, [
    studentId,
    flashcardId,
    attempts,
    correct,
    status,
  ]);
  return true;
}

module.exports = {
  listLibrariesByModule,
  getLibraryWithCards,
  upsertLibraryProgress,
  upsertCardProgress,
  listLibrariesByBulkModules
};
