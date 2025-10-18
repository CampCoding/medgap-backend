const { client } = require("../../config/db-connect");

// Study Plan CRUD
async function createStudyPlan({
  studentId,
  planName,
  startDate,
  endDate,
  studyDays,
  dailyTimeBudget,
  dailyLimits,
  questionMode,
  difficultyBalance,
  questionsPerSession,
}) {
  const sql = `INSERT INTO student_study_plans 
               (student_id, plan_name, start_date, end_date, study_days, daily_time_budget, 
                daily_limits, question_mode, difficulty_balance, questions_per_session)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    studentId,
    planName,
    startDate,
    endDate,
    JSON.stringify(studyDays),
    dailyTimeBudget,
    dailyLimits ? JSON.stringify(dailyLimits) : null,
    questionMode,
    difficultyBalance,
    questionsPerSession,
  ];

  const [result] = await client.execute(sql, params);
  return { plan_id: result.insertId };
}

async function getStudyPlans({ studentId, status = null }) {
  let sql = `SELECT * FROM student_study_plans WHERE student_id = ?`;
  let params = [studentId];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC`;

  const [rows] = await client.execute(sql, params);
  return rows.map((row) => ({
    ...row,
    study_days: JSON.parse(row.study_days),
    daily_limits: row.daily_limits ? JSON.parse(row.daily_limits) : null,
  }));
}

async function getStudyPlanById({ planId, studentId }) {
  const [rows] = await client.execute(
    `SELECT * FROM student_study_plans WHERE plan_id = ? AND student_id = ?`,
    [planId, studentId]
  );

  if (rows.length === 0) return null;

  const plan = rows[0];
  // Fetch qbanks created within plan period with progress for this student
  const [qbanks] = await client.execute(
    `SELECT 
       q.*,
       COUNT(DISTINCT qq.question_id) AS question_count,
       COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END) AS solved_count,
       COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
       CASE 
         WHEN COUNT(DISTINCT qq.question_id) = 0 THEN 0
         ELSE ROUND((COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END) / COUNT(DISTINCT qq.question_id)) * 100, 0)
       END AS progress_percent,
       CASE 
         WHEN COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END) = 0 THEN 0
         ELSE ROUND((COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) / COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END)) * 100, 0)
       END AS accuracy_percent
     FROM qbank q
     LEFT JOIN qbank_questions qq ON q.qbank_id = qq.qbank_id
     LEFT JOIN solved_questions sq 
       ON sq.qbank_id = q.qbank_id 
      AND sq.question_id = qq.question_id 
      AND sq.student_id = ?
     WHERE q.deleted = '0' 
       AND q.student_id = ?
       AND q.created_at BETWEEN ? AND ?
     GROUP BY q.qbank_id
     ORDER BY q.qbank_id DESC`,
    [studentId, studentId, plan.start_date, plan.end_date]
  );

  // Fetch exams within plan period with student progress (latest attempt in period)
  const [exams] = await client.execute(
    `SELECT 
       e.exam_id as id,
       e.title as name,
       e.scheduled_date,
       e.start_date,
       e.end_date,
       e.duration,
       e.difficulty,
       e.status,
       m.subject_name as subject_name,
       COUNT(DISTINCT eq.question_id) as questions,
       ea.exam_attempt_id,
       ea.status as attempt_status,
       ea.total_score,
       COUNT(DISTINCT ans.exam_answer_id) AS answered_count,
       SUM(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers,
       CASE 
         WHEN COUNT(DISTINCT eq.question_id) = 0 THEN 0
         WHEN ea.status = 'submitted' THEN ROUND((ea.total_score / COUNT(DISTINCT eq.question_id)) * 100, 0)
         ELSE ROUND((COUNT(DISTINCT ans.exam_answer_id) / COUNT(DISTINCT eq.question_id)) * 100, 0)
       END AS progress_percent
     FROM exams e
     LEFT JOIN modules m ON e.subject_id = m.module_id
     LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
     LEFT JOIN (
        SELECT ea1.*
        FROM exam_attempts ea1
        INNER JOIN (
          SELECT exam_id, MAX(COALESCE(submitted_at, started_at)) AS latest_time
          FROM exam_attempts
          WHERE student_id = ?
            AND (
              (started_at IS NOT NULL AND started_at BETWEEN ? AND ?)
              OR (submitted_at IS NOT NULL AND submitted_at BETWEEN ? AND ?)
            )
          GROUP BY exam_id
        ) latest ON latest.exam_id = ea1.exam_id
        AND COALESCE(ea1.submitted_at, ea1.started_at) = latest.latest_time
        WHERE ea1.student_id = ?
     ) ea ON ea.exam_id = e.exam_id
     LEFT JOIN exam_answers ans ON ans.attempt_id = ea.exam_attempt_id
     WHERE m.module_id IN (
       SELECT se.module_id FROM student_enrollments se WHERE se.student_id = ? AND se.status = 'active'
     )
     AND (
       (e.scheduled_date IS NOT NULL AND e.scheduled_date BETWEEN ? AND ?)
       OR (e.start_date IS NOT NULL AND e.start_date BETWEEN ? AND ?)
       OR (e.end_date IS NOT NULL AND e.end_date BETWEEN ? AND ?)
     )
     GROUP BY e.exam_id
     ORDER BY COALESCE(e.scheduled_date, e.start_date, e.end_date) ASC`,
    [
      studentId,
      plan.start_date,
      plan.end_date,
      plan.start_date,
      plan.end_date,
      studentId,
      studentId,
      plan.start_date,
      plan.end_date,
      plan.start_date,
      plan.end_date,
      plan.start_date,
      plan.end_date,
    ]
  );

  // Fetch flashcards solved within plan period (per deck and totals)
  const [flashcardsByDeck] = await client.execute(
    `SELECT 
       sd.student_deck_id AS deck_id,
       sd.deck_title,
       COUNT(*) AS studied_count,
       SUM(CASE WHEN sfc.card_solved = '1' THEN 1 ELSE 0 END) AS solved_count
     FROM student_flash_cards sfc
     INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
     WHERE sd.student_id = ?
       AND sfc.solved_at IS NOT NULL
       AND sfc.solved_at BETWEEN ? AND ?
     GROUP BY sd.student_deck_id, sd.deck_title
     ORDER BY MAX(sfc.solved_at) DESC`,
    [studentId, plan.start_date, plan.end_date]
  );

  const [flashcardsTotalRow] = await client.execute(
    `SELECT 
       COUNT(*) AS total_studied,
       SUM(CASE WHEN sfc.card_solved = '1' THEN 1 ELSE 0 END) AS total_solved
     FROM student_flash_cards sfc
     INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
     WHERE sd.student_id = ?
       AND sfc.solved_at IS NOT NULL
       AND sfc.solved_at BETWEEN ? AND ?`,
    [studentId, plan.start_date, plan.end_date]
  );

  const flashcardsTotals = flashcardsTotalRow && flashcardsTotalRow[0]
    ? {
      total_studied: Number(flashcardsTotalRow[0].total_studied) || 0,
      total_solved: Number(flashcardsTotalRow[0].total_solved) || 0,
    }
    : { total_studied: 0, total_solved: 0 };

  return {
    ...plan,
    study_days: JSON.parse(plan.study_days),
    daily_limits: plan.daily_limits ? JSON.parse(plan.daily_limits) : null,
    qbanks_in_period: qbanks,
    exams_in_period: exams,
    flashcards_in_period: {
      totals: flashcardsTotals,
      by_deck: flashcardsByDeck,
    },
  };
}

async function updateStudyPlan({
  planId,
  studentId,
  planName,
  startDate,
  endDate,
  studyDays,
  dailyTimeBudget,
  dailyLimits,
  questionMode,
  difficultyBalance,
  questionsPerSession,
  status,
}) {
  // First check if the plan exists and belongs to the student
  const existingPlan = await getStudyPlanById({ planId, studentId });
  if (!existingPlan) {
    return false;
  }

  const updates = [];
  const params = [];

  if (planName !== undefined) {
    updates.push("plan_name = ?");
    params.push(planName);
  }
  if (startDate !== undefined) {
    updates.push("start_date = ?");
    params.push(startDate);
  }
  if (endDate !== undefined) {
    updates.push("end_date = ?");
    params.push(endDate);
  }
  if (studyDays !== undefined) {
    updates.push("study_days = ?");
    params.push(JSON.stringify(studyDays));
  }
  if (dailyTimeBudget !== undefined) {
    updates.push("daily_time_budget = ?");
    params.push(dailyTimeBudget);
  }
  if (dailyLimits !== undefined) {
    updates.push("daily_limits = ?");
    params.push(dailyLimits ? JSON.stringify(dailyLimits) : null);
  }
  if (questionMode !== undefined) {
    updates.push("question_mode = ?");
    params.push(questionMode);
  }
  if (difficultyBalance !== undefined) {
    updates.push("difficulty_balance = ?");
    params.push(difficultyBalance);
  }
  if (questionsPerSession !== undefined) {
    updates.push("questions_per_session = ?");
    params.push(questionsPerSession);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length === 0) return true; // No updates needed

  params.push(planId, studentId);
  const sql = `UPDATE student_study_plans SET ${updates.join(
    ", "
  )} WHERE plan_id = ? AND student_id = ?`;

  const [result] = await client.execute(sql, params);
  return result.affectedRows > 0;
}

async function deleteStudyPlan({ planId, studentId }) {
  const [result] = await client.execute(
    `DELETE FROM student_study_plans WHERE plan_id = ? AND student_id = ?`,
    [planId, studentId]
  );
  return result.affectedRows > 0;
}

// Plan Content Management
async function addPlanContent({
  planId,
  examsModules,
  examsTopics,
  flashcardsModules,
  flashcardsTopics,
  questionBankModules,
  questionBankTopics,
  questionBankQuizzes,
  subjects,
}) {
  const sql = `INSERT INTO student_plan_content 
               (plan_id, exams_modules, exams_topics, flashcards_modules, flashcards_topics, 
                question_bank_modules, question_bank_topics, question_bank_quizzes, subjects)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    planId,
    examsModules ? JSON.stringify(examsModules) : null,
    examsTopics ? JSON.stringify(examsTopics) : null,
    flashcardsModules ? JSON.stringify(flashcardsModules) : null,
    flashcardsTopics ? JSON.stringify(flashcardsTopics) : null,
    questionBankModules ? JSON.stringify(questionBankModules) : null,
    questionBankTopics ? JSON.stringify(questionBankTopics) : null,
    questionBankQuizzes ? JSON.stringify(questionBankQuizzes) : null,
    subjects ? JSON.stringify(subjects) : null,
  ];

  const [result] = await client.execute(sql, params);
  return { content_id: result.insertId };
}

async function getPlanContent({ planId }) {
  const [rows] = await client.execute(
    `SELECT * FROM student_plan_content WHERE plan_id = ?`,
    [planId]
  );

  if (rows.length === 0) return null;

  const content = rows[0];
  const parsedContent = {
    ...content,
    exams_modules: content.exams_modules
      ? JSON.parse(content.exams_modules)
      : [],
    exams_topics: content.exams_topics ? JSON.parse(content.exams_topics) : [],
    flashcards_modules: content.flashcards_modules
      ? JSON.parse(content.flashcards_modules)
      : [],
    flashcards_topics: content.flashcards_topics
      ? JSON.parse(content.flashcards_topics)
      : [],
    question_bank_modules: content.question_bank_modules
      ? JSON.parse(content.question_bank_modules)
      : [],
    question_bank_topics: content.question_bank_topics
      ? JSON.parse(content.question_bank_topics)
      : [],
    question_bank_quizzes: content.question_bank_quizzes
      ? JSON.parse(content.question_bank_quizzes)
      : [],
    subjects: content.subjects ? JSON.parse(content.subjects) : [],
  };

  // Get detailed module and topic information
  const detailedContent = await getDetailedContentInfo(parsedContent);

  return detailedContent;
}

async function removePlanContent({ contentId, planId }) {
  const [result] = await client.execute(
    `DELETE FROM student_plan_content WHERE content_id = ? AND plan_id = ?`,
    [contentId, planId]
  );
  return result.affectedRows > 0;
}

// Plan Sessions Management
async function generatePlanSessions({ planId, studentId }) {
  // Get plan details
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) throw new Error("Plan not found");

  // Get plan content
  const content = await getPlanContent({ planId });

  if (!content) {
    throw new Error("No content added to plan");
  }

  // Only generate one session for the next valid study day
  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);
  const studyDays = plan.study_days; // [1,2,3,4,5] for Mon-Fri

  // Create content items array from the new structure
  const contentItems = [];

  // Add exams content
  if (content.exams_modules && content.exams_modules.length > 0) {
    contentItems.push({
      content_id: content.content_id,
      content_type: "exams",
      modules: content.exams_modules,
      topics: content.exams_topics || [],
    });
  }

  // Add flashcards content
  if (content.flashcards_modules && content.flashcards_modules.length > 0) {
    contentItems.push({
      content_id: content.content_id,
      content_type: "flashcards",
      modules: content.flashcards_modules,
      topics: content.flashcards_topics || [],
    });
  }

  // Add question bank content
  if (
    content.question_bank_modules &&
    content.question_bank_modules.length > 0
  ) {
    contentItems.push({
      content_id: content.content_id,
      content_type: "question_bank",
      modules: content.question_bank_modules,
      topics: content.question_bank_topics || [],
      quizzes: content.question_bank_quizzes || [],
      subjects: content.subjects || [],
    });
  }

  if (contentItems.length === 0) {
    throw new Error("No content added to plan");
  }

  // Convert string days to numbers if needed
  let studyDaysNumbers = studyDays;
  if (typeof studyDays[0] === "string") {
    const dayMap = {
      Sat: 0,
      Saturday: 0,
      Sun: 1,
      Sunday: 1,
      Mon: 2,
      Monday: 2,
      Tue: 3,
      Tuesday: 3,
      Wed: 4,
      Wednesday: 4,
      Thu: 5,
      Thursday: 5,
      Fri: 6,
      Friday: 6,
    };
    studyDaysNumbers = studyDays.map((day) => dayMap[day] || day);
  }

  // Find the first upcoming valid study date within the range
  let sessionDate = null;
  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dayOfWeek = date.getDay();
    if (studyDaysNumbers.includes(dayOfWeek)) {
      sessionDate = date.toISOString().split("T")[0];
      break;
    }
  }

  if (!sessionDate) {
    throw new Error("No valid study day found in the specified range");
  }

  // Just pick the first content item for this single session
  const contentItem = contentItems[0];

  let createdSessionId = null;
  if (contentItem) {
    const sql = `INSERT INTO student_plan_sessions 
                 (plan_id, session_date, session_type, content_id)
                 VALUES (?, ?, ?, ?)`;

    const valueSet = [
      planId,
      sessionDate,
      contentItem.content_type,
      contentItem.content_id,
    ];

    const [result] = await client.execute(sql, valueSet);
    createdSessionId = result && result.insertId ? result.insertId : null;
  }

  return { sessions_created: createdSessionId ? 1 : 0, session_id: createdSessionId };
}

async function getPlanSessions({
  planId,
  studentId,
  date = null,
  status = null,
}) {
  let sql = `SELECT s.*, c.exams_modules, c.exams_topics, c.flashcards_modules, 
             c.flashcards_topics, c.question_bank_modules, c.question_bank_topics, 
             c.question_bank_quizzes, c.subjects
             FROM student_plan_sessions s
             JOIN student_plan_content c ON c.content_id = s.content_id
             WHERE s.plan_id = ?`;

  let params = [planId];

  if (date) {
    sql += ` AND s.session_date = ?`;
    params.push(date);
  }

  if (status) {
    sql += ` AND s.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY s.session_date ASC, s.created_at ASC`;

  const [rows] = await client.execute(sql, params);

  // Parse JSON fields
  const parsedSessions = rows.map((row) => ({
    ...row,
    exams_modules: row.exams_modules ? JSON.parse(row.exams_modules) : [],
    exams_topics: row.exams_topics ? JSON.parse(row.exams_topics) : [],
    flashcards_modules: row.flashcards_modules
      ? JSON.parse(row.flashcards_modules)
      : [],
    flashcards_topics: row.flashcards_topics
      ? JSON.parse(row.flashcards_topics)
      : [],
    question_bank_modules: row.question_bank_modules
      ? JSON.parse(row.question_bank_modules)
      : [],
    question_bank_topics: row.question_bank_topics
      ? JSON.parse(row.question_bank_topics)
      : [],
    question_bank_quizzes: row.question_bank_quizzes
      ? JSON.parse(row.question_bank_quizzes)
      : [],
    subjects: row.subjects ? JSON.parse(row.subjects) : [],
  }));

  // Get detailed information for each session
  const detailedSessions = await Promise.all(
    parsedSessions.map(async (session) => {
      const detailedContent = await getDetailedContentInfo(session);
      return detailedContent;
    })
  );

  return detailedSessions;
}

// Get a single session details (questions + flashcards + progress)
async function getSessionDetails({ planId, studentId, sessionId }) {
  // Verify session belongs to plan and student
  const [sessions] = await client.execute(
    `SELECT s.*, c.exams_modules, c.exams_topics, c.flashcards_modules, 
            c.flashcards_topics, c.question_bank_modules, c.question_bank_topics, 
            c.question_bank_quizzes
     FROM student_plan_sessions s
     JOIN student_plan_content c ON c.content_id = s.content_id
     WHERE s.session_id = ? AND s.plan_id = ?`,
    [sessionId, planId]
  );
  if (!sessions.length) return null;
  const session = sessions[0];

  // Fetch plan limits and per-session goals
  const [planRows] = await client.execute(
    `SELECT questions_per_session, daily_limits FROM student_study_plans WHERE plan_id = ? LIMIT 1`,
    [planId]
  );
  const planRow = planRows && planRows[0] ? planRows[0] : { questions_per_session: 20, daily_limits: null };
  const dailyLimits = planRow.daily_limits ? JSON.parse(planRow.daily_limits) : {};
  const questionsGoalPerSession = Number(planRow.questions_per_session) || 20;
  const flashcardsGoalPerSession = Number(dailyLimits.max_flashcards) || 50;

  // Parse JSON arrays
  const qbModules = session.question_bank_modules ? JSON.parse(session.question_bank_modules) : [];
  const qbTopics = session.question_bank_topics ? JSON.parse(session.question_bank_topics) : [];
  const flashModules = session.flashcards_modules ? JSON.parse(session.flashcards_modules) : [];
  const flashTopics = session.flashcards_topics ? JSON.parse(session.flashcards_topics) : [];

  // ------------------ QUESTIONS QUERY ------------------
  let whereQ = ["q.status = 'active'"];
  const valuesQ = [];
  if (qbTopics.length) {
    whereQ.push(`q.topic_id IN (${qbTopics.map(() => '?').join(',')})`);
    valuesQ.push(...qbTopics);
  } else if (qbModules.length) {
    whereQ.push(`u.module_id IN (${qbModules.map(() => '?').join(',')})`);
    valuesQ.push(...qbModules);
  }

  const questionsSql = `
SELECT 
  qq.qbank_id,
  q.question_id,
  q.question_text,
  q.question_type,
  q.difficulty_level,
  top.*,
  unit.*,
  module.*,
  smc.*,
  mcq.mark_category_question_id AS marked,
  mcq.category_id,
  COALESCE(
    JSON_ARRAYAGG(
      CASE WHEN notes.question_note_id IS NOT NULL THEN JSON_OBJECT(
        'note_id', notes.question_note_id,
        'note_text', notes.note_text
      ) END
    ), JSON_ARRAY()
  ) AS notes,
  COALESCE(
    JSON_ARRAYAGG(
      CASE WHEN qo.option_id IS NOT NULL THEN JSON_OBJECT(
        'option_id', qo.option_id,
        'option_text', qo.option_text,
        'is_correct', qo.is_correct,
        'explanation', qo.explanation
      ) END
    ), JSON_ARRAY()
  ) AS options,
  JSON_OBJECT('is_correct', sq.is_correct) AS your_answer,
  COALESCE(
    JSON_ARRAYAGG(
      DISTINCT CASE WHEN sfc.student_flash_card_id IS NOT NULL THEN JSON_OBJECT(
        'student_flash_card_id', sfc.student_flash_card_id,
        'deck_id', sfc.deck_id,
        'front', sfc.student_flash_card_front,
        'back', sfc.student_flash_card_back,
        'tags', sfc.tags,
        'card_status', sfc.card_status,
        'card_solved', sfc.card_solved,
        'difficulty', sfc.difficulty,
        'ease_factor', sfc.ease_factor,
        'repetitions', sfc.repetitions,
        'interval_days', sfc.interval_days,
        'last_reviewed', sfc.last_reviewed,
        'next_review', sfc.next_review
      ) END
    ), JSON_ARRAY()
  ) AS flashcards
FROM questions q
LEFT JOIN qbank_questions qq ON qq.question_id = q.question_id
LEFT JOIN question_options qo ON qo.question_id = q.question_id
LEFT JOIN topics top ON top.topic_id = q.topic_id
LEFT JOIN units unit ON unit.unit_id = top.unit_id
LEFT JOIN modules module ON module.module_id = unit.module_id
LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id
LEFT JOIN student_mark_categories smc ON smc.student_mark_category_id = mcq.category_id
LEFT JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ?
LEFT JOIN question_notes notes ON notes.question_id = q.question_id
LEFT JOIN student_flash_cards sfc ON sfc.question_id = q.question_id
${whereQ.length ? `WHERE ${whereQ.join(' AND ')}` : ''}
GROUP BY q.question_id
ORDER BY q.created_at DESC
LIMIT ${questionsGoalPerSession}`;  // ✅ apply question limit here

  const [questionRows] = await client.execute(questionsSql, [studentId, ...valuesQ]);

  // ------------------ PARSE QUESTION DATA ------------------
  for (const q of questionRows) {
    try {
      if (typeof q.options === 'string') q.options = JSON.parse(q.options).filter(Boolean);
      if (typeof q.notes === 'string') q.notes = JSON.parse(q.notes).filter(Boolean);
      const answerParsed = JSON.parse(q.your_answer || '{}');
      answerParsed.solved = answerParsed?.is_correct != null;
      q.your_answer = answerParsed;

      if (typeof q.flashcards === 'string') {
        const parsed = JSON.parse(q.flashcards).filter(Boolean);
        for (const fc of parsed) {
          if (typeof fc.tags === 'string') {
            try { fc.tags = JSON.parse(fc.tags); } catch { }
          }
        }
        q.flashcards = parsed;
      }
    } catch { }
  }

  // Truncate questions array if more than limit (safety)
  const limitedQuestions = questionRows.slice(0, questionsGoalPerSession);

  // ------------------ FLASHCARDS QUERY ------------------
  let whereF = ["f.status IN ('active','draft')"];
  const valuesF = [];
  if (flashTopics.length) {
    whereF.push(`f.topic_id IN (${flashTopics.map(() => '?').join(',')})`);
    valuesF.push(...flashTopics);
  } else if (flashModules.length) {
    whereF.push(`u.module_id IN (${flashModules.map(() => '?').join(',')})`);
    valuesF.push(...flashModules);
  }

  const flashcardsSql = `
    SELECT f.flashcard_id,
           f.front_text,
           f.back_text,
           f.difficulty_level,
           COALESCE(cp.attempts, 0) AS attempts,
           COALESCE(cp.correct, 0) AS correct,
           COALESCE(cp.status, 'new') AS card_status,
           cp.last_seen
    FROM flashcards f
    LEFT JOIN topics t ON t.topic_id = f.topic_id
    LEFT JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN modules m ON m.module_id = u.module_id
    LEFT JOIN student_flashcard_card_progress cp
      ON cp.flashcard_id = f.flashcard_id AND cp.student_id = ?
    ${whereF.length ? `WHERE ${whereF.join(' AND ')}` : ''}
    ORDER BY f.card_order, f.flashcard_id
    LIMIT ${flashcardsGoalPerSession}`;  // ✅ apply flashcard limit here

  const [flashcardRows] = await client.execute(flashcardsSql, [studentId, ...valuesF]);

  // ------------------ CALCULATE PROGRESS ------------------
  const totalQuestions = limitedQuestions.length;
  const questionsAttempted = limitedQuestions.reduce((a, q) => a + (q.your_answer?.solved ? 1 : 0), 0);
  const questionsCorrect = limitedQuestions.reduce((a, q) => a + (q.your_answer?.is_correct ? 1 : 0), 0);
  const questionProgress = totalQuestions ? Math.round((questionsAttempted / totalQuestions) * 100) : 0;

  const totalFlashcards = flashcardRows.length;
  const flashcardsStudied = flashcardRows.reduce((a, c) => a + (c.attempts > 0 ? 1 : 0), 0);
  const flashcardsCorrect = flashcardRows.reduce((a, c) => a + (c.correct > 0 ? 1 : 0), 0);
  const flashcardsProgress = totalFlashcards ? Math.round((flashcardsStudied / totalFlashcards) * 100) : 0;

  // ------------------ RETURN ------------------
  return {
    session: {
      session_id: session.session_id,
      session_date: session.session_date,
      session_type: session.session_type,
      status: session.status,
    },
    questions: limitedQuestions,             // ✅ capped by questionsGoalPerSession
    flashcards: flashcardRows,               // ✅ capped by flashcardsGoalPerSession
    limits: {                                // ✅ added this section
      questions_limit: questionsGoalPerSession,
      flashcards_limit: flashcardsGoalPerSession,
    },
    progress: {
      questions: {
        attempted: questionsAttempted,
        correct: questionsCorrect,
        total: totalQuestions,
        progress_percent: questionProgress,
      },
      flashcards: {
        studied: flashcardsStudied,
        correct: flashcardsCorrect,
        total: totalFlashcards,
        progress_percent: flashcardsProgress,
      },
    },
  };
}

// Solve a question within a session and update progress
async function solveSessionQuestion({ planId, sessionId, studentId, questionId, selectedOptionId = null, answerText = null }) {
  // Validate session
  const [sessions] = await client.execute(
    `SELECT s.session_id, c.question_bank_modules, c.question_bank_topics
     FROM student_plan_sessions s
     JOIN student_plan_content c ON c.content_id = s.content_id
     WHERE s.session_id = ? AND s.plan_id = ?
     LIMIT 1`,
    [sessionId, planId]
  );
  if (!sessions.length) return { success: false, message: 'Session not found' };
  const session = sessions[0];

  const qbModules = session.question_bank_modules ? JSON.parse(session.question_bank_modules) : [];
  const qbTopics = session.question_bank_topics ? JSON.parse(session.question_bank_topics) : [];

  // Ensure question belongs to allowed topics/modules (if filters exist)
  let checkSql = `SELECT q.question_id FROM questions q`;
  const checkWhere = [];
  const checkVals = [questionId];
  if (qbTopics.length) {
    checkWhere.push(`q.topic_id IN (${qbTopics.map(() => '?').join(',')})`);
    checkVals.push(...qbTopics);
  } else if (qbModules.length) {
    checkSql += ` INNER JOIN topics t ON t.topic_id = q.topic_id INNER JOIN units u ON u.unit_id = t.unit_id`;
    checkWhere.push(`u.module_id IN (${qbModules.map(() => '?').join(',')})`);
    checkVals.push(...qbModules);
  }
  const [qCheck] = await client.execute(
    `${checkSql} WHERE q.question_id = ? ${checkWhere.length ? ' AND ' + checkWhere.join(' AND ') : ''} LIMIT 1`,
    checkVals
  );
  if (!qCheck.length) return { success: false, message: 'Question not in session scope' };

  // Determine correctness
  let isCorrect = 0;
  if (selectedOptionId) {
    const [optRows] = await client.execute(
      `SELECT is_correct FROM question_options WHERE option_id = ? AND question_id = ? LIMIT 1`,
      [selectedOptionId, questionId]
    );
    isCorrect = optRows.length && (optRows[0].is_correct === 1 || optRows[0].is_correct === '1') ? 1 : 0;
  } else if (answerText != null) {
    const [optRows] = await client.execute(
      `SELECT is_correct FROM question_options WHERE question_id = ? AND option_text = ? LIMIT 1`,
      [questionId, answerText]
    );
    isCorrect = optRows.length && (optRows[0].is_correct === 1 || optRows[0].is_correct === '1') ? 1 : 0;
  }

  // Save global solved record
  await client.execute(
    `INSERT INTO solved_questions (question_id, student_id, answer, is_correct, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [questionId, studentId, answerText || String(selectedOptionId || ''), isCorrect ? '1' : '0']
  );

  // Update session aggregates atomically
  await client.execute(
    `UPDATE student_plan_sessions 
     SET questions_attempted = COALESCE(questions_attempted,0) + 1,
         questions_correct = COALESCE(questions_correct,0) + ?
     WHERE session_id = ? AND plan_id = ?`,
    [isCorrect ? 1 : 0, sessionId, planId]
  );

  return { success: true, attempted: 1, correct: isCorrect };
}

// Review a flashcard within a session and update progress
async function reviewSessionFlashcard({ planId, sessionId, studentId, flashcardId, correct = false, status = 'seen' }) {
  // Validate session
  const [sessions] = await client.execute(
    `SELECT s.session_id, c.flashcards_modules, c.flashcards_topics
     FROM student_plan_sessions s
     JOIN student_plan_content c ON c.content_id = s.content_id
     WHERE s.session_id = ? AND s.plan_id = ?
     LIMIT 1`,
    [sessionId, planId]
  );
  if (!sessions.length) return { success: false, message: 'Session not found' };
  const session = sessions[0];

  const flashModules = session.flashcards_modules ? JSON.parse(session.flashcards_modules) : [];
  const flashTopics = session.flashcards_topics ? JSON.parse(session.flashcards_topics) : [];

  // Ensure flashcard belongs to allowed topics/modules
  let fCheckSql = `SELECT f.flashcard_id FROM flashcards f`;
  const fWhere = [];
  const fVals = [flashcardId];
  if (flashTopics.length) {
    fWhere.push(`f.topic_id IN (${flashTopics.map(() => '?').join(',')})`);
    fVals.push(...flashTopics);
  } else if (flashModules.length) {
    fCheckSql += ` INNER JOIN topics t ON t.topic_id = f.topic_id INNER JOIN units u ON u.unit_id = t.unit_id`;
    fWhere.push(`u.module_id IN (${flashModules.map(() => '?').join(',')})`);
    fVals.push(...flashModules);
  }
  const [fCheck] = await client.execute(
    `${fCheckSql} WHERE f.flashcard_id = ? ${fWhere.length ? ' AND ' + fWhere.join(' AND ') : ''} LIMIT 1`,
    fVals
  );
  if (!fCheck.length) return { success: false, message: 'Flashcard not in session scope' };

  // Save per-card progress
  await client.execute(
    `INSERT INTO student_flashcard_card_progress (student_id, flashcard_id, attempts, correct, status, last_seen)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       attempts = attempts + VALUES(attempts),
       correct = correct + VALUES(correct),
       status = VALUES(status),
       last_seen = NOW()`,
    [studentId, flashcardId, 1, correct ? 1 : 0, status]
  );

  // Update session aggregates
  await client.execute(
    `UPDATE student_plan_sessions 
     SET flashcards_studied = COALESCE(flashcards_studied,0) + 1
     WHERE session_id = ? AND plan_id = ?`,
    [sessionId, planId]
  );

  return { success: true, studied: 1, correct: correct ? 1 : 0 };
}

// Helper function to get sessions with daily schedule
async function getSessionsWithSchedule({ planId, studentId }) {
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) return null;

  const sessions = await getPlanSessions({ planId, studentId });
  const summary = await getPlanSummary({ planId, studentId });

  // Group sessions by date
  const sessionsByDate = {};
  sessions.forEach((session) => {
    const date = session.session_date;
    if (!sessionsByDate[date]) {
      sessionsByDate[date] = [];
    }
    sessionsByDate[date].push(session);
  });

  // Create daily schedule
  const dailySchedule = [];
  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();
    const isStudyDay = plan.study_days.includes(dayOfWeek);

    const daySessions = sessionsByDate[dateStr] || [];

    // Calculate total time for the day
    const totalTime =
      daySessions.length * (plan.daily_time_budget / plan.study_days.length);
    const hours = Math.floor(totalTime / 60);
    const minutes = Math.round(totalTime % 60);
    const timeFormatted = `${hours}h ${minutes}m`;

    dailySchedule.push({
      date: dateStr,
      day_name: date.toLocaleDateString("en-US", { weekday: "long" }),
      is_study_day: isStudyDay,
      sessions: daySessions,
      total_time: timeFormatted,
      sessions_count: daySessions.length,
    });
  }

  return {
    summary: summary,
    daily_schedule: dailySchedule,
    total_sessions: sessions.length,
  };
}

// Build "today" tasks and stats for the UI
async function getTodayOverview({ studentId }) {
  // Pick the most recent active plan that includes today
  const today = new Date().toISOString().split('T')[0];
  const [plans] = await client.execute(
    `SELECT * FROM student_study_plans 
     WHERE student_id = ? AND status = 'active' 
       AND start_date <= ? AND end_date >= ?
     ORDER BY updated_at DESC LIMIT 1`,
    [studentId, today, today]
  );
  if (!plans.length) {
    return {
      tasks: [],
      stats: { study_time_minutes: 0, questions_today: { attempted: 0, correct: 0, goal: 0 }, flashcards_today: { studied: 0, accuracy_percent: 0 }, completion_percentage: 0 },
      recent_sessions: []
    };
  }
  const plan = plans[0];

  // Sessions for today
  const sessions = await getPlanSessions({ planId: plan.plan_id, studentId, date: today, status: null });

  const dailyLimits = plan.daily_limits ? JSON.parse(plan.daily_limits) : {};
  const questionsGoalPerSession = Number(plan.questions_per_session) || 20;
  const flashcardsGoalPerSession = Number(dailyLimits.max_flashcards) || 50;

  const sessionsCount = sessions.length || 1;
  const minutesPerSession = Math.max(10, Math.round((Number(plan.daily_time_budget) || 60) / sessionsCount));

  // Aggregate stats
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalStudied = 0;
  let totalFlashCorrect = 0;
  let completedCount = 0;
  let studyTimeMinutes = 0;

  // Map sessions to UI tasks
  const tasks = sessions.map((s, idx) => {
    const isQuestions = s.session_type === 'question_bank' || s.session_type === 'questions';
    const isFlashcards = s.session_type === 'flashcards';
    const title = isQuestions ? 'Practice Questions' : isFlashcards ? 'Study Flashcards' : 'Study Content';
    const subtitle = (s.question_bank_modules_detailed?.[0]?.name || s.flashcards_modules_detailed?.[0]?.name || s.exams_modules_detailed?.[0]?.name) || 'General';
    const status = s.status || 'pending';
    if (status === 'completed') completedCount += 1;

    // Use stored aggregates if present (from session progress updates)
    const questionsAttempted = Number(s.questions_attempted) || 0;
    const questionsCorrect = Number(s.questions_correct) || 0;
    const flashcardsStudied = Number(s.flashcards_studied) || 0;
    const timeSpent = Number(s.time_spent) || 0;

    totalAttempted += questionsAttempted;
    totalCorrect += questionsCorrect;
    totalStudied += flashcardsStudied;
    studyTimeMinutes += Math.round(timeSpent / 60);

    // Per-session progress vs content type
    let progress = 0;
    if (isQuestions) {
      progress = Math.min(100, Math.round((questionsAttempted / questionsGoalPerSession) * 100));
    } else if (isFlashcards) {
      progress = Math.min(100, Math.round((flashcardsStudied / flashcardsGoalPerSession) * 100));
    } else {
      // content type - approximate by time share
      progress = Math.min(100, Math.round(((timeSpent / 60) / minutesPerSession) * 100));
    }

    return {
      id: s.session_id,
      title,
      subtitle,
      type: isQuestions ? 'questions' : isFlashcards ? 'flashcards' : 'content',
      duration: `${minutesPerSession}m`,
      status,
      priority: idx % 3 === 0 ? 'high' : (idx % 3 === 1 ? 'medium' : 'low'),
      progress,
      dueTime: null,
      description: null,
      notes: null,
    };
  });

  const questionsGoalToday = sessions.filter(s => (s.session_type === 'question_bank' || s.session_type === 'questions')).length * questionsGoalPerSession;
  const flashcardsGoalToday = sessions.filter(s => s.session_type === 'flashcards').length * flashcardsGoalPerSession;
  const accuracyPercent = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const completionPercentage = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Recent sessions (last 5 by date, any status)
  const [recentRows] = await client.execute(
    `SELECT s.session_id, s.session_date, s.session_type, s.status,
            COALESCE(s.questions_attempted,0) AS questions_attempted,
            COALESCE(s.flashcards_studied,0) AS flashcards_studied,
            COALESCE(s.time_spent,0) AS time_spent
     FROM student_plan_sessions s
     WHERE s.plan_id = ?
     ORDER BY s.session_date DESC, s.created_at DESC
     LIMIT 5`,
    [plan.plan_id]
  );
  const recent_sessions = recentRows.map(r => ({
    id: r.session_id,
    date: r.session_date,
    type: r.session_type,
    status: r.status,
    questions_attempted: Number(r.questions_attempted) || 0,
    flashcards_studied: Number(r.flashcards_studied) || 0,
    time_spent_minutes: Math.round((Number(r.time_spent) || 0) / 60),
  }));

  return {
    plan: { id: plan.plan_id, name: plan.plan_name },
    tasks,
    stats: {
      study_time_minutes: studyTimeMinutes,
      questions_today: { attempted: totalAttempted, correct: totalCorrect, goal: questionsGoalToday },
      flashcards_today: { studied: totalStudied, goal: flashcardsGoalToday, accuracy_percent: accuracyPercent },
      completion_percentage: completionPercentage,
    },
    recent_sessions,
  };
}

// Study dashboard overview for UI widgets
async function getDashboardOverview({ studentId }) {
  const today = new Date().toISOString().split('T')[0];

  // Active plan
  const [plans] = await client.execute(
    `SELECT * FROM student_study_plans 
     WHERE student_id = ? AND status = 'active' 
     AND start_date <= ? AND end_date >= ? 
     ORDER BY updated_at DESC LIMIT 1`,
    [studentId, today, today]
  );
  const plan = plans[0] || null;

  // Current plan progress (completed sessions vs total sessions in window)
  let currentPlan = { completed: 0, total: 0 };
  if (plan) {
    const [sess] = await client.execute(
      `SELECT 
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM student_plan_sessions
       WHERE plan_id = ?`,
      [plan.plan_id]
    );
    currentPlan = { completed: Number(sess[0].completed) || 0, total: Number(sess[0].total) || 0 };
  }

  // Overall healthcare mastered proxy (topics with any activity)
  const [hc] = await client.execute(
    `SELECT 
       COUNT(DISTINCT t.topic_id) AS total_topics,
       COUNT(DISTINCT sq.question_id) AS attempted_questions
     FROM topics t
     LEFT JOIN solved_questions sq ON sq.student_id = ?
     LIMIT 1`,
    [studentId]
  );
  const healthcareMastered = {
    completed: Number(hc[0].attempted_questions) || 0,
    total: Math.max(Number(hc[0].total_topics) || 0, Number(hc[0].attempted_questions) || 0)
  };

  // Study break (streak gap proxy): days since last activity
  const [lastAct] = await client.execute(
    `SELECT DATE(MAX(created_at)) AS last_day 
     FROM student_activity_log WHERE student_id = ?`,
    [studentId]
  );
  let studyBreak = 0;
  if (lastAct[0]?.last_day) {
    const last = new Date(lastAct[0].last_day + 'T00:00:00Z');
    const now = new Date(today + 'T00:00:00Z');
    studyBreak = Math.max(0, Math.round((now - last) / (1000 * 60 * 60 * 24)));
  }

  // Recent activity
  const [recent] = await client.execute(
    `SELECT activity_type, activity_description, score_percentage, points_earned, created_at
     FROM student_activity_log
     WHERE student_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [studentId]
  );
  const recentActivity = recent.map(r => ({
    title: r.activity_type,
    details: r.activity_description,
    time: new Date(r.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    points: r.points_earned ? `+${r.points_earned} pts` : ''
  }));

  // Upcoming deadlines: upcoming exams within next 14 days and plan end date
  const [upcomingExams] = await client.execute(
    `SELECT e.title, DATE_FORMAT(COALESCE(e.scheduled_date, e.start_date, e.end_date), '%b %e') AS date_fmt,
            m.subject_name
     FROM exams e
     LEFT JOIN modules m ON e.subject_id = m.module_id
     WHERE (e.scheduled_date > NOW() OR e.start_date > NOW() OR e.end_date > NOW())
       AND COALESCE(e.scheduled_date, e.start_date, e.end_date) <= DATE_ADD(NOW(), INTERVAL 14 DAY)
       AND m.module_id IN (
         SELECT se.module_id FROM student_enrollments se WHERE se.student_id = ? AND se.status = 'active'
       )
     ORDER BY COALESCE(e.scheduled_date, e.start_date, e.end_date) ASC
     LIMIT 6`,
    [studentId]
  );
  const upcomingDeadlines = [
    ...(upcomingExams || []).map(e => ({ title: e.title, date: e.date_fmt, course: e.subject_name, urgent: true })),
    ...(plan ? [{ title: `Complete ${plan.plan_name}`, date: new Date(plan.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), course: 'Personal Goal', urgent: false }] : [])
  ].slice(0, 6);

  // Stats
  const [qStats] = await client.execute(
    `SELECT COUNT(*) AS answered, SUM(CASE WHEN is_correct = '1' THEN 1 ELSE 0 END) AS correct
     FROM solved_questions WHERE student_id = ?`,
    [studentId]
  );
  const accuracy = (Number(qStats[0].answered) || 0) > 0
    ? Math.round((Number(qStats[0].correct) / Number(qStats[0].answered)) * 100)
    : 0;
  const [hours] = await client.execute(
    `SELECT COALESCE(SUM(time_spent),0) AS seconds
     FROM student_plan_sessions WHERE plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)`,
    [studentId]
  );
  const hoursStudied = Math.round((Number(hours[0].seconds) || 0) / 3600);
  const [anyExam] = await client.execute(
    `SELECT DATEDIFF(MIN(COALESCE(e.scheduled_date, e.start_date, e.end_date)), CURDATE()) AS days
     FROM exams e
     LEFT JOIN modules m ON e.subject_id = m.module_id
     WHERE (e.scheduled_date > NOW() OR e.start_date > NOW() OR e.end_date > NOW())
       AND m.module_id IN (
         SELECT se.module_id FROM student_enrollments se WHERE se.student_id = ? AND se.status = 'active'
       )
     ORDER BY COALESCE(e.scheduled_date, e.start_date, e.end_date) ASC
     LIMIT 1`,
    [studentId]
  );
  const daysUntilExam = Math.max(0, Number(anyExam[0]?.days) || 0);

  return {
    currentPlan,
    healthcareMastered,
    studyBreak,
    recentActivity,
    upcomingDeadlines,
    stats: {
      questionsAnswered: Number(qStats[0].answered) || 0,
      hoursStudied,
      accuracy,
      daysUntilExam,
    },
  };
}

async function updateSessionProgress({
  sessionId,
  studentId,
  questionsAttempted,
  questionsCorrect,
  flashcardsStudied,
  timeSpent,
  status,
}) {
  const updates = [];
  const params = [];

  if (questionsAttempted !== undefined) {
    updates.push("questions_attempted = ?");
    params.push(questionsAttempted);
  }
  if (questionsCorrect !== undefined) {
    updates.push("questions_correct = ?");
    params.push(questionsCorrect);
  }
  if (flashcardsStudied !== undefined) {
    updates.push("flashcards_studied = ?");
    params.push(flashcardsStudied);
  }
  if (timeSpent !== undefined) {
    updates.push("time_spent = ?");
    params.push(timeSpent);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length === 0) return false;

  params.push(sessionId, studentId);
  const sql = `UPDATE student_plan_sessions SET ${updates.join(", ")} 
               WHERE session_id = ? AND plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)`;

  const [result] = await client.execute(sql, params);
  return result.affectedRows > 0;
}

// Helper function to get detailed content information
async function getDetailedContentInfo(content) {
  const detailedContent = { ...content };

  // Get detailed module information for all module types
  const allModuleIds = [
    ...(content.exams_modules || []),
    ...(content.flashcards_modules || []),
    ...(content.question_bank_modules || []),
  ];

  // Get detailed topic information for all topic types
  const allTopicIds = [
    ...(content.exams_topics || []),
    ...(content.flashcards_topics || []),
    ...(content.question_bank_topics || []),
  ];

  // Get modules details
  if (allModuleIds.length > 0) {
    const [modulesRows] = await client.execute(
      `SELECT module_id, subject_name, subject_code, description, subject_color 
       FROM modules 
       WHERE module_id IN (${allModuleIds.map(() => "?").join(",")}) 
       AND status = 'active'`,
      allModuleIds
    );

    const modulesMap = {};
    modulesRows.forEach((module) => {
      modulesMap[module.module_id] = {
        id: module.module_id,
        name: module.subject_name,
        code: module.subject_code,
        description: module.description,
        color: module.subject_color,
      };
    });

    // Add detailed modules to each content type
    detailedContent.exams_modules_detailed = (content.exams_modules || [])
      .map((id) => modulesMap[id])
      .filter(Boolean);
    detailedContent.flashcards_modules_detailed = (
      content.flashcards_modules || []
    )
      .map((id) => modulesMap[id])
      .filter(Boolean);
    detailedContent.question_bank_modules_detailed = (
      content.question_bank_modules || []
    )
      .map((id) => modulesMap[id])
      .filter(Boolean);

    // Get subjects (units) for these modules
    const [unitsRows] = await client.execute(
      `SELECT unit_id, unit_name, module_id, status, unit_order
       FROM units 
       WHERE module_id IN (${allModuleIds.map(() => "?").join(",")})
         AND status = 'active'
       ORDER BY unit_order ASC, created_at ASC`,
      allModuleIds
    );

    // Aggregate subjects
    const subjectsByModule = {};
    unitsRows.forEach((unit) => {
      if (!subjectsByModule[unit.module_id]) subjectsByModule[unit.module_id] = [];
      subjectsByModule[unit.module_id].push({
        id: unit.unit_id,
        name: unit.unit_name,
        module_id: unit.module_id,
      });
    });

    // Add detailed subjects per content type and combined
    detailedContent.exams_subjects_detailed = (content.exams_modules || [])
      .flatMap((mid) => subjectsByModule[mid] || [])
      .filter(Boolean);
    detailedContent.flashcards_subjects_detailed = (
      content.flashcards_modules || []
    )
      .flatMap((mid) => subjectsByModule[mid] || [])
      .filter(Boolean);
    detailedContent.question_bank_subjects_detailed = (
      content.question_bank_modules || []
    )
      .flatMap((mid) => subjectsByModule[mid] || [])
      .filter(Boolean);
    detailedContent.subjects_detailed = unitsRows.map((u) => ({
      id: u.unit_id,
      name: u.unit_name,
      module_id: u.module_id,
    }));
  }

  // Get topics details
  if (allTopicIds.length > 0) {
    const [topicsRows] = await client.execute(
      `SELECT t.topic_id, t.topic_name, t.short_description, t.learning_objectives,
              u.unit_id, u.unit_name, u.module_id,
              m.subject_name as module_name, m.subject_code as module_code
       FROM topics t
       INNER JOIN units u ON u.unit_id = t.unit_id
       INNER JOIN modules m ON m.module_id = u.module_id
       WHERE t.topic_id IN (${allTopicIds.map(() => "?").join(",")}) 
       AND t.status = 'active' AND u.status = 'active' AND m.status = 'active'`,
      allTopicIds
    );

    const topicsMap = {};
    topicsRows.forEach((topic) => {
      topicsMap[topic.topic_id] = {
        id: topic.topic_id,
        name: topic.topic_name,
        description: topic.short_description,
        learning_objectives: topic.learning_objectives,
        unit: {
          id: topic.unit_id,
          name: topic.unit_name,
        },
        module: {
          id: topic.module_id,
          name: topic.module_name,
          code: topic.module_code,
        },
      };
    });

    // Add detailed topics to each content type
    detailedContent.exams_topics_detailed = (content.exams_topics || [])
      .map((id) => topicsMap[id])
      .filter(Boolean);
    detailedContent.flashcards_topics_detailed = (
      content.flashcards_topics || []
    )
      .map((id) => topicsMap[id])
      .filter(Boolean);
    detailedContent.question_bank_topics_detailed = (
      content.question_bank_topics || []
    )
      .map((id) => topicsMap[id])
      .filter(Boolean);
  }

  return detailedContent;
}

// Helper function to get plan summary information
async function getPlanSummary({ planId, studentId }) {
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) return null;

  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);
  const studyDays = plan.study_days;

  // Calculate total days and study days
  const totalDays =
    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Count study days
  let studyDaysCount = 0;
  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dayOfWeek = date.getDay();
    if (studyDays.includes(dayOfWeek)) {
      studyDaysCount++;
    }
  }

  // Get content summary
  const content = await getPlanContent({ planId });
  let totalItems = 0;

  if (content) {
    totalItems +=
      (content.exams_modules?.length || 0) +
      (content.exams_topics?.length || 0);
    totalItems +=
      (content.flashcards_modules?.length || 0) +
      (content.flashcards_topics?.length || 0);
    totalItems +=
      (content.question_bank_modules?.length || 0) +
      (content.question_bank_topics?.length || 0);
    totalItems += content.question_bank_quizzes?.length || 0;
  }

  // Format daily budget
  const hours = Math.floor(plan.daily_time_budget / 60);
  const minutes = plan.daily_time_budget % 60;
  const dailyBudget = `${hours}h ${minutes}m`;

  return {
    date_range: {
      start: plan.start_date,
      end: plan.end_date,
    },
    total_days: totalDays,
    study_days: studyDaysCount,
    total_items: totalItems,
    daily_budget: dailyBudget,
    plan_name: plan.plan_name,
    status: plan.status,
  };
}

// Helper functions
async function getModulesWithStats({ studentId = null } = {}) {
  // First, let's get basic module info
  let sql = `
    SELECT m.module_id, m.subject_name as module_name, m.subject_code, m.description as module_description,
           m.subject_color
    FROM modules m
    WHERE m.status = 'active'
  `;

  let params = [];

  // If studentId is provided, only get modules the student is enrolled in
  if (studentId) {
    sql += ` AND m.module_id IN (
      SELECT se.module_id 
      FROM student_enrollments se
      WHERE se.student_id = ? AND se.status = 'active'
    )`;
    params.push(studentId);
  }

  sql += ` ORDER BY m.subject_name`;

  const [modules] = await client.execute(sql, params);

  // Now get stats for each module
  const modulesWithStats = await Promise.all(
    modules.map(async (module) => {
      // Get units count
      const [unitsResult] = await client.execute(
        `SELECT COUNT(*) as count FROM units WHERE module_id = ? AND status = 'active'`,
        [module.module_id]
      );

      // Get topics count
      const [topicsResult] = await client.execute(
        `SELECT COUNT(*) as count FROM topics t 
       INNER JOIN units u ON u.unit_id = t.unit_id 
       WHERE u.module_id = ? AND t.status = 'active' AND u.status = 'active'`,
        [module.module_id]
      );

      // Get questions count
      const [questionsResult] = await client.execute(
        `SELECT COUNT(*) as count FROM questions q
       INNER JOIN topics t ON t.topic_id = q.topic_id
       INNER JOIN units u ON u.unit_id = t.unit_id
       WHERE u.module_id = ? AND t.status = 'active' AND u.status = 'active'`,
        [module.module_id]
      );

      return {
        ...module,
        units_count: unitsResult[0].count,
        topics_count: topicsResult[0].count,
        questions_count: questionsResult[0].count,
      };
    })
  );

  return modulesWithStats;
}

async function getTopicsByModule({ moduleId }) {
  console.log("moduleId", moduleId)
  const [rows] = await client.execute(
    `
    SELECT t.topic_id, t.topic_name, t.short_description,
           u.unit_id, u.unit_name,
           COUNT(DISTINCT q.question_id) as questions_count,
           COUNT(DISTINCT f.flashcard_id) as flashcards_count
    FROM topics t
    INNER JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    WHERE u.module_id IN ? AND t.status = 'active' AND u.status = 'active'
    GROUP BY t.topic_id, t.topic_name, t.short_description, u.unit_id, u.unit_name
    ORDER BY u.unit_order, t.topic_order, t.topic_name
  `,
    [moduleId]
  );
  return rows;
}



async function getTopicsBySubject({ moduleId, studentId }) {
  console.log("moduleId", moduleId);

  // Normalize unit IDs
  let unitIds = moduleId;
  if (typeof unitIds === "string") {
    unitIds = unitIds.split(",").map(id => id.trim()).filter(Boolean);
  } else if (!Array.isArray(unitIds)) {
    unitIds = [unitIds];
  }

  // Ensure unitIds is an array and not null/undefined
  if (!unitIds || !unitIds.length) return [];

  const placeholders = unitIds.map(() => "?").join(",");
  const params = [...unitIds];
  console.log("placeholders, params", placeholders, params);

  // --- 1. Get topics with aggregated counts ---
  const [topicRows] = await client.execute(
    `
    SELECT 
      t.topic_id, 
      t.topic_name, 
      t.short_description,
      u.unit_id, 
      u.unit_name,
      COUNT(DISTINCT q.question_id) AS questions_count,
      COUNT(DISTINCT f.flashcard_id) AS flashcards_count,
      ${studentId ? `
        COUNT(DISTINCT sq.question_id) AS attempted_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' THEN sq.question_id END) AS wrong_count,
        COUNT(DISTINCT CASE WHEN q.question_id IS NOT NULL AND sq.question_id IS NULL THEN q.question_id END) AS unsolved_count,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL THEN q.question_id END) AS marked_count
      ` : `
        0 AS attempted_count,
        0 AS correct_count,
        0 AS wrong_count,
        COUNT(DISTINCT q.question_id) AS unsolved_count,
        0 AS marked_count
      `}
    FROM topics t
    LEFT JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    ${studentId ? `
      LEFT JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ?
      LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id
      LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?
    ` : ''}
    WHERE u.unit_id IN (${placeholders})
      AND t.status = 'active'
      AND u.status = 'active'
    GROUP BY 
      t.topic_id, t.topic_name, t.short_description,
      u.unit_id, u.unit_name
    ORDER BY u.unit_order, t.topic_order, t.topic_name
    `,
    studentId ? [studentId, studentId, ...params] : params
  );

  console.log("topicRows length:", `
    SELECT 
      t.topic_id, 
      t.topic_name, 
      t.short_description,
      u.unit_id, 
      u.unit_name,
      COUNT(DISTINCT q.question_id) AS questions_count,
      COUNT(DISTINCT f.flashcard_id) AS flashcards_count,
      ${studentId ? `
        COUNT(DISTINCT sq.question_id) AS attempted_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' THEN sq.question_id END) AS wrong_count,
        COUNT(DISTINCT CASE WHEN q.question_id IS NOT NULL AND sq.question_id IS NULL THEN q.question_id END) AS unsolved_count,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL THEN q.question_id END) AS marked_count
      ` : `
        0 AS attempted_count,
        0 AS correct_count,
        0 AS wrong_count,
        COUNT(DISTINCT q.question_id) AS unsolved_count,
        0 AS marked_count
      `}
    FROM topics t
    LEFT JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    ${studentId ? `
      LEFT JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ?
      LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id
      LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?
    ` : ''}
    WHERE u.unit_id IN (?)
      AND t.status = 'active'
      AND u.status = 'active'
    GROUP BY 
      t.topic_id, t.topic_name, t.short_description,
      u.unit_id, u.unit_name
    ORDER BY u.unit_order, t.topic_order, t.topic_name
    `, studentId ? [studentId, studentId, params?.join(", ")] : params?.join(", "));

  if (!studentId || !topicRows.length) return topicRows;

  // --- 2. Get per-question student details ---
  const topicIds = topicRows.map(row => row.topic_id);
  const topicPlaceholders = topicIds.map(() => "?").join(",");

  const [questionRows] = await client.execute(
    `
    SELECT 
      q.topic_id,
      q.question_id,
      CASE WHEN sq.question_id IS NOT NULL THEN 1 ELSE 0 END AS attempted,
      CASE WHEN sq.is_correct = '1' THEN 1 ELSE 0 END AS correct,
      CASE WHEN mcq.question_id IS NOT NULL AND smc.student_mark_category_id IS NOT NULL THEN 1 ELSE 0 END AS marked
    FROM questions q
    LEFT JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ?
    LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id
    LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?
    WHERE q.topic_id IN (${topicPlaceholders})
    `,
    [studentId, studentId, ...topicIds]
  );

  console.log("questionRows length:", questionRows.length);

  // --- 3. Group questions by topic ---
  const questionsByTopic = {};
  questionRows.forEach(q => {
    if (!questionsByTopic[q.topic_id]) {
      questionsByTopic[q.topic_id] = [];
    }
    questionsByTopic[q.topic_id].push({
      question_id: q.question_id,
      attempted: !!q.attempted,
      correct: !!q.correct,
      marked: !!q.marked
    });
  });

  // --- 4. Combine and return ---
  return topicRows.map(topic => ({
    ...topic,
    questions: questionsByTopic[topic.topic_id] || []
  }));
}

async function getSubjectsByModule({ moduleId }) {
  console.log("moduleId", moduleId);

  let unitIds = moduleId;
  if (typeof unitIds === "string") {
    unitIds = unitIds.split(",").map((id) => id.trim()).filter(Boolean);
  }
  if (!Array.isArray(unitIds)) {
    unitIds = [unitIds];
  }

  if (!unitIds.length) return [];

  const placeholders = unitIds.map(() => "?").join(",");
  const [rows] = await client.execute(
    `
    SELECT un.unit_id, un.unit_name,
           COUNT(DISTINCT q.question_id) as questions_count,
           COUNT(DISTINCT f.flashcard_id) as flashcards_count,
           COUNT(DISTINCT t.topic_id) as topics_count
    FROM units un
    LEFT JOIN topics t ON t.unit_id = un.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    WHERE un.module_id IN (${placeholders}) AND un.status = 'active'
    GROUP BY un.unit_id, un.unit_name
    ORDER BY un.unit_order
  `,
    unitIds
  );
  return rows;
}

// Get marked categories and questions for a student
async function getMarkedCategoriesAndQuestions(studentId) {
  const sql = `
    SELECT 
      mcq.category_id,
      mcq.question_id,
      CASE WHEN smc.id IS NOT NULL THEN 1 ELSE 0 END AS is_marked
    FROM 
      mark_category_question mcq
    LEFT JOIN 
      student_mark_categories smc ON mcq.category_id = smc.category_id 
      AND smc.student_id = ?
    ORDER BY 
      mcq.category_id, mcq.question_id
  `;

  const [rows] = await client.execute(sql, [studentId]);

  // Group by category
  const categoriesMap = {};

  rows.forEach(row => {
    if (!categoriesMap[row.category_id]) {
      categoriesMap[row.category_id] = {
        categoryId: row.category_id,
        questions: []
      };
    }

    categoriesMap[row.category_id].questions.push({
      questionId: row.question_id,
      isMarked: row.is_marked === 1
    });
  });

  return Object.values(categoriesMap);
}

module.exports = {
  createStudyPlan,
  getStudyPlans,
  getStudyPlanById,
  updateStudyPlan,
  deleteStudyPlan,
  addPlanContent,
  getPlanContent,
  removePlanContent,
  generatePlanSessions,
  getPlanSessions,
  updateSessionProgress,
  getModulesWithStats,
  getTopicsByModule,
  getPlanSummary,
  getSessionsWithSchedule,
  getTopicsBySubject,
  getSubjectsByModule,
  getSessionDetails,
  solveSessionQuestion,
  reviewSessionFlashcard,
  getTodayOverview,
  getDashboardOverview,
  getMarkedCategoriesAndQuestions
};