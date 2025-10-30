const { client } = require("../../config/db-connect");
const { getDatesBetween } = require("../../utils/getDateBetween");
const activityTracking = require("./activityTracking");
const { createQbank } = require("./qbank");

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
  questionBankModules,
  questionBankTopics,
  questionBankSubject,
  questionBankQuizzes,
  booksModule,
  books,
  flashcardsDecks,
  flashcardsModules,
  booksIndeces,
  exams_modules,
  exams_topics,
  exams,
  question_level = ["easy", "medium", "hard"],
}) {
  const sql = `INSERT INTO student_study_plans 
               (student_id, plan_name, start_date, end_date, study_days, daily_time_budget, 
                daily_limits, question_mode, difficulty_balance, questions_per_session, questionBankModules, questionBankTopics, questionBankSubject,  booksModule, booksIndeces, books, flashcardsDecks, flashcardsModules, exams)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
    questionBankModules ? JSON.stringify(questionBankModules) : null,
    questionBankTopics ? JSON.stringify(questionBankTopics) : null,
    questionBankSubject ? JSON.stringify(questionBankSubject) : null,
    booksModule ? JSON.stringify(booksModule) : null,
    booksIndeces ? JSON.stringify(booksIndeces) : null,
    books ? JSON.stringify(books) : null,
    flashcardsDecks ? JSON.stringify(flashcardsDecks) : null,
    flashcardsModules ? JSON.stringify(flashcardsModules) : null,
    exams ? JSON.stringify(exams) : null,

  ];
  console.log(getDatesBetween(startDate, endDate, studyDays, { locale: 'en-US', timeZone: 'Africa/Cairo' }))
  const [result] = await client.execute(sql, params);
  const qbankId = await Promise.all(
    getDatesBetween(startDate, endDate, studyDays, { locale: 'en-US', timeZone: 'Africa/Cairo' }).map(async (date) => {
      return await createQbank({
        studentId,
        qbankName: planName,
        tutorMode: 0,
        timed: 0,
        timeType: "none",
        plan_id: result.insertId,
        day: date.day?.substring(0, 3),
        date_schedule: date.date,
        selected_modules: questionBankModules,
        selected_subjects: questionBankSubject,
        selected_topics: questionBankTopics,
        question_level: question_level,
        numQuestions: questionsPerSession,
        question_mode: questionMode,
      });
    }));
  console.log("qbankId", booksIndeces);
 
  getDatesBetween(startDate, endDate, studyDays, { locale: 'en-US', timeZone: 'Africa/Cairo' }).map(async (date, index) => {
    return await createSession({
      planId: result.insertId,
      studentId: studentId,
      studyDay: index + 1,
      studyDayDate: date?.date,
      studyDayName: date?.day?.substring(0, 3),
      qbankId: qbankId[index] ? qbankId[index] : 0,
      examId: exams[index] ? exams[index] : 0,
      flashcarddeckId: flashcardsDecks ? flashcardsDecks[index] : 0,
      ebookId: books ? books : 0,
      indexId: booksIndeces ? booksIndeces[index] : 0,
    });
  });
  // await Promise.all(studyDays.map(async (day, index) => {

  // }));
  // await generatePlanSessions({ planId: result.insertId, studentId: studentId, studyDaysNumbers: studyDays });

  return { plan_id: result.insertId };
}


const createSession = async ({ planId, studentId, studyDay, studyDayName, qbankId, examId, flashcarddeckId, ebookId, indexId, studyDayDate }) => {
  const paramsSafe = [
    planId, studentId, studyDay, studyDayName,
    qbankId, examId, flashcarddeckId, ebookId, indexId, studyDayDate
  ].map(v => v === undefined ? null : v);
console.log(paramsSafe);
  const sql = `INSERT INTO new_student_plan_sessions (plan_id, student_id, study_day, study_day_name, qbank_id, exam_id, flashcarddeck_id, ebook_id, index_id, study_day_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [planId, studentId, studyDay, studyDayName, qbankId, examId, flashcarddeckId, ebookId, indexId, studyDayDate];
  const [result] = await client.execute(sql, paramsSafe);
  return result.insertId;
}

// Plan Sessions Management
async function generatePlanSessions({ planId, studentId, studyDaysNumbers }) {
  // Get plan details
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) throw new Error("Plan not found");

  // Normalize study_days to an array
  let study_days;
  if (Array.isArray(plan.study_days)) {
    study_days = plan.study_days;
  } else if (typeof plan.study_days === 'string') {
    try {
      const parsed = JSON.parse(plan.study_days);
      study_days = Array.isArray(parsed) ? parsed : (plan.study_days ? plan.study_days.split(',') : []);
    } catch {
      study_days = plan.study_days ? plan.study_days.split(',') : [];
    }
  } else {
    study_days = [];
  }

  // Function to safely parse JSON fields
  const safeParse = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  let parsedPlan = {
    ...plan,
    study_days,
    daily_limits: safeParse(plan.daily_limits),
    questionBankModules: safeParse(plan.questionBankModules),
    questionBankTopics: safeParse(plan.questionBankTopics),
    questionBankSubject: safeParse(plan.questionBankSubject),
    booksModule: safeParse(plan.booksModule),
    booksIndeces: safeParse(plan.booksIndeces),
    books: safeParse(plan.books),
    flashcardsDecks: safeParse(plan.flashcardsDecks),
    flashcardsModules: safeParse(plan.flashcardsModules),
    exams: safeParse(plan.exams),
  };

  // Normalize potential non-array values to arrays
  const normalizeToArray = (val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    return [val];
  };

  parsedPlan.questionBankModules = normalizeToArray(parsedPlan.questionBankModules);
  parsedPlan.questionBankTopics = normalizeToArray(parsedPlan.questionBankTopics);
  parsedPlan.questionBankSubject = normalizeToArray(parsedPlan.questionBankSubject);
  parsedPlan.booksModule = normalizeToArray(parsedPlan.booksModule);
  parsedPlan.booksIndeces = normalizeToArray(parsedPlan.booksIndeces);
  parsedPlan.books = normalizeToArray(parsedPlan.books);
  parsedPlan.flashcardsDecks = normalizeToArray(parsedPlan.flashcardsDecks);
  parsedPlan.flashcardsModules = normalizeToArray(parsedPlan.flashcardsModules);
  parsedPlan.exams = normalizeToArray(parsedPlan.exams);

  // Build separate content rows per type so sessions can point to type-specific content
  const contentRowsByType = {};
  // Helper to insert a content row with only relevant fields
  const insertContentRow = async ({
    examsModules = null,
    examsTopics = null,
    flashcardsModules = null,
    flashcardsTopics = null,
    questionBankModules = null,
    questionBankTopics = null,
    questionBankQuizzes = null,
    subjects = null,
  }) => {
    const sql = `INSERT INTO student_plan_content (
               plan_id, exams_modules, exams_topics, flashcards_modules, flashcards_topics,
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
      subjects ? JSON.stringify(subjects) : JSON.stringify(['all']),
    ];
    const [ins] = await client.execute(sql, params);
    return ins.insertId;
  };

  const availableTypes = [];
  if (parsedPlan.questionBankModules.length > 0 || parsedPlan.questionBankTopics.length > 0) {
    contentRowsByType.question_bank = await insertContentRow({
      questionBankModules: parsedPlan.questionBankModules,
      questionBankTopics: parsedPlan.questionBankTopics,
      questionBankQuizzes: null,
      subjects: parsedPlan.questionBankSubject,
    });
    availableTypes.push("question_bank");
  }
  if (parsedPlan.flashcardsModules.length > 0 || parsedPlan.flashcardsTopics.length > 0) {
    contentRowsByType.flashcards = await insertContentRow({
      flashcardsModules: parsedPlan.flashcardsModules,
      flashcardsTopics: null,
    });
    availableTypes.push("flashcards");
  }
  if (parsedPlan.books.length > 0 || parsedPlan.booksModule.length > 0) {
    // Treat ebooks as content subjects/modules
    contentRowsByType.ebooks = await insertContentRow({
      subjects: parsedPlan.booksModule,
    });
    availableTypes.push("ebooks");
  }
  if (parsedPlan.exams.length > 0) {
    contentRowsByType.exams = await insertContentRow({
      examsModules: parsedPlan.exams_modules || [],
      examsTopics: parsedPlan.exams_topics || [],
    });
    availableTypes.push("exams");
  }
  // Fallback: if nothing specific, still avoid crashing
  const contentItems = availableTypes.map((t) => ({ content_type: t, content_id: contentRowsByType[t] }));

  // Convert string days to numbers if needed
  let studyDaysNumbersParsed = parsedPlan.study_days;
  if (typeof studyDaysNumbersParsed[0] === "string") {
    const dayMap = {
      Sun: 0, Sunday: 0,
      Mon: 1, Monday: 1,
      Tue: 2, Tuesday: 2,
      Wed: 3, Wednesday: 3,
      Thu: 4, Thursday: 4,
      Fri: 5, Friday: 5,
      Sat: 6, Saturday: 6,
    };
    studyDaysNumbersParsed = studyDaysNumbersParsed.map((day) => {
      const d = String(day).trim();
      return dayMap[d] ?? Number(d);
    });
  }

  // Prepare statements
  const insertSql = `INSERT INTO student_plan_sessions 
               (plan_id, session_date, session_type, content_id)
               VALUES (?, ?, ?, ?)`;
  const existsSql = `SELECT session_id FROM student_plan_sessions WHERE plan_id = ? AND session_date = ? AND session_type = ? LIMIT 1`;

  // Iterate all dates, insert sessions on study days, rotating content types across days
  let createdCount = 0;
  let firstSessionId = null;
  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);
  let rotationIndex = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (!studyDaysNumbersParsed.includes(day)) continue;
    const dateStr = d.toISOString().split("T")[0];
    if (!contentItems.length) continue;
    // Choose next content type in round-robin
    const item = contentItems[rotationIndex % contentItems.length];
    rotationIndex += 1;

    // Skip duplicates per date/type
    const [exists] = await client.execute(existsSql, [planId, dateStr, item.content_type]);
    if (exists && exists.length) continue;

    const contentIdForType = item.content_id || null;
    const [result] = await client.execute(insertSql, [planId, dateStr, item.content_type, contentIdForType]);
    if (result && result.insertId) {
      createdCount += 1;
      if (!firstSessionId) firstSessionId = result.insertId;
    }
  }

  if (createdCount === 0) {
    return { sessions_created: 0, session_id: null };
  }
  return { sessions_created: createdCount, session_id: firstSessionId };
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
    subjects ? JSON.stringify(subjects) : JSON.stringify(['all']),
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
    subjects: content.subjects ? JSON.parse(content.subjects) : JSON.stringify(['all']),
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



async function getPlanSessions({
  planId,
  studentId,
  date = null,
  status = null,
}) {/*library_id, library_name, description, difficulty_level, estimated_time, status, created_at, updated_at, created_by, updated_by, topic_id, module_id */
  let sql = `SELECT 
  
  new_student_plan_content.*,
  new_student_plan_sessions.*,
  JSON_OBJECT(
    'qbank_id', qbank.qbank_id,
    'qbank_name', qbank.qbank_name,
    'qbank_created_at', qbank.created_at
  ) as qbank,
  JSON_OBJECT(
    'exam_id', exams.exam_id,
    'exam_name', exams.title,
    'difficulty', exams.difficulty,
    'exam_created_at', exams.created_at
  ) as exams,
  JSON_OBJECT(
    'flashcarddeck_id', flashcard_libraries.library_id,
    'flashcarddeck_name', flashcard_libraries.library_name,
    'flashcarddeck_description', flashcard_libraries.description,
    'flashcarddeck_created_at', flashcard_libraries.created_at
  ) as flashcards_decks,
   JSON_OBJECT(
    'ebook_id', ebooks.ebook_id,
    'ebook_name', ebooks.book_title,
    'ebook_description', ebooks.book_description,
    'ebook_created_at', ebooks.created_at,
    'index_id', ebook_indeces.ebook_index_id,
    'index_title', ebook_indeces.index_title,
    'index_page', ebook_indeces.page_number,
    'index_order', ebook_indeces.order_index
  ) as ebooks
             FROM new_student_plan_sessions 
             LEFT JOIN qbank ON new_student_plan_sessions.qbank_id = qbank.qbank_id
             LEFT JOIN exams ON new_student_plan_sessions.exam_id = exams.exam_id
             LEFT JOIN flashcard_libraries ON new_student_plan_sessions.flashcarddeck_id = flashcard_libraries.library_id
             LEFT JOIN ebooks ON new_student_plan_sessions.ebook_id = ebooks.ebook_id
             LEFT JOIN ebook_indeces ON new_student_plan_sessions.index_id = ebook_indeces.ebook_index_id
             LEFT JOIN new_student_plan_content ON new_student_plan_sessions.session_id = new_student_plan_content.session_id

             WHERE new_student_plan_sessions.plan_id = ?`;

  let params = [planId];
  const [rows] = await client.execute(sql, params);
  rows.map((item)=>{ 
    item.flashcards_decks = JSON.parse(item.flashcards_decks);
    item.exams = JSON.parse(item.exams);
    item.qbank = JSON.parse(item.qbank);
    item.ebooks = JSON.parse(item.ebooks);
    item.ebooks = item.ebooks?.ebook_id ? item.ebooks : {};
    item.ebooks = item.ebooks?.index_id ? item.ebooks : {};
    item.flashcards_decks = item.flashcards_decks?.flashcarddeck_id ? item.flashcards_decks : {};
    item.exams = item.exams?.exam_id ? item.exams : {};
    item.qbank = item.qbank?.qbank_id ? item.qbank : {};
    return item;
  })
  return rows.map((item)=>{
    return {
      ...item,
      ebooks: item.ebooks?.ebook_id ? item.ebooks : {},
    }
  })
}

const startSessionContent = async ({ planId, studentId, sessionId, contentType, contentId}) => {
  const sql = `INSERT INTO new_student_plan_content (plan_id, student_id, session_id, content_type, content_id, progress) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [planId, studentId, sessionId, contentType, contentId, 0];
  const [result] = await client.execute(sql, params);
  return result.insertId;
}



/**
 ebook_index_id, ebook_id, parent_id, level, order_index, index_title, page_number, created_at
 */

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
      q.tags = JSON.parse(q.tags).filter(Boolean);
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

  // Log activity automatically
  try {
    // Get question details for better activity description
    const [questionDetails] = await client.execute(
      `SELECT question_text, question_type, difficulty_level, topic_id 
       FROM questions WHERE question_id = ? LIMIT 1`,
      [questionId]
    );

    const question = questionDetails[0];
    if (question) {
      await activityTracking.logActivity({
        studentId,
        activityType: "question_answered",
        activityDescription: `Answered question in study session: ${question.question_text.substring(0, 50)}...`,
        moduleName: null, // Could be enhanced to get module info
        topicName: null, // Could be enhanced to get topic info
        scorePercentage: isCorrect ? 100 : 0,
        pointsEarned: isCorrect ? 10 : 0, // 10 points for correct, 0 for incorrect
        metadata: {
          question_id: questionId,
          session_id: sessionId,
          plan_id: planId,
          answer: answerText || String(selectedOptionId || ''),
          is_correct: isCorrect,
          question_type: question.question_type,
          difficulty_level: question.difficulty_level,
          context: 'study_session'
        }
      });
    }
  } catch (activityError) {
    console.error("Failed to log activity for session question solve:", activityError);
    // Don't throw error - activity logging is not critical
  }

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

  // Log activity automatically
  try {
    // Get flashcard details for better activity description
    const [flashcardDetails] = await client.execute(
      `SELECT front_text, back_text, difficulty_level, topic_id 
       FROM flashcards WHERE flashcard_id = ? LIMIT 1`,
      [flashcardId]
    );

    const flashcard = flashcardDetails[0];
    if (flashcard) {
      await activityTracking.logActivity({
        studentId,
        activityType: "flashcard_studied",
        activityDescription: `Studied flashcard: ${flashcard.front_text.substring(0, 50)}...`,
        moduleName: null, // Could be enhanced to get module info
        topicName: null, // Could be enhanced to get topic info
        scorePercentage: correct ? 100 : 0,
        pointsEarned: correct ? 5 : 0, // 5 points for correct, 0 for incorrect
        metadata: {
          flashcard_id: flashcardId,
          session_id: sessionId,
          plan_id: planId,
          is_correct: correct,
          status: status,
          difficulty_level: flashcard.difficulty_level,
          context: 'study_session'
        }
      });
    }
  } catch (activityError) {
    console.error("Failed to log activity for flashcard review:", activityError);
    // Don't throw error - activity logging is not critical
  }

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
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'easy' THEN q.question_id END) AS easy_count,
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'medium' THEN q.question_id END) AS medium_count,
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'hard' THEN q.question_id END) AS difficult_count,
      ${studentId ? `
        COUNT(DISTINCT sq.question_id) AS attempted_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' THEN sq.question_id END) AS wrong_count,
        COUNT(DISTINCT CASE WHEN q.question_id IS NOT NULL AND sq.question_id IS NULL THEN q.question_id END) AS unsolved_count,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL THEN q.question_id END) AS marked_count,
        -- Correct counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'easy' THEN q.question_id END) AS correct_count_easy,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'medium' THEN q.question_id END) AS correct_count_medium,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'hard' THEN q.question_id END) AS correct_count_hard,
        -- Wrong counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'easy' THEN q.question_id END) AS wrong_count_easy,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'medium' THEN q.question_id END) AS wrong_count_medium,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'hard' THEN q.question_id END) AS wrong_count_hard,
        -- Unused counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'easy' THEN q.question_id END) AS unused_count_easy,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'medium' THEN q.question_id END) AS unused_count_medium,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'hard' THEN q.question_id END) AS unused_count_hard,
        -- Marked counts by difficulty
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'easy' THEN q.question_id END) AS marked_count_easy,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'medium' THEN q.question_id END) AS marked_count_medium,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'hard' THEN q.question_id END) AS marked_count_hard
      ` : `
        0 AS attempted_count,
        0 AS correct_count,
        0 AS wrong_count,
        COUNT(DISTINCT q.question_id) AS unsolved_count,
        0 AS marked_count,
        -- Correct counts by difficulty (all 0 when no student)
        0 AS correct_count_easy,
        0 AS correct_count_medium,
        0 AS correct_count_hard,
        -- Wrong counts by difficulty (all 0 when no student)
        0 AS wrong_count_easy,
        0 AS wrong_count_medium,
        0 AS wrong_count_hard,
        -- Unused counts by difficulty (same as total counts when no student)
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'easy' THEN q.question_id END) AS unused_count_easy,
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'medium' THEN q.question_id END) AS unused_count_medium,
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'hard' THEN q.question_id END) AS unused_count_hard,
        -- Marked counts by difficulty (all 0 when no student)
        0 AS marked_count_easy,
        0 AS marked_count_medium,
        0 AS marked_count_hard
      `}
    FROM topics t
    LEFT JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    ${studentId ? `
      LEFT JOIN (
        SELECT s1.question_id, s1.is_correct
        FROM solved_questions s1
        INNER JOIN (
          SELECT question_id, MAX(created_at) AS max_created
          FROM solved_questions
          WHERE student_id = ?
          GROUP BY question_id
        ) latest ON latest.question_id = s1.question_id AND latest.max_created = s1.created_at
        WHERE s1.student_id = ?
      ) sq ON sq.question_id = q.question_id
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
    studentId ? [studentId, studentId, studentId, ...params] : params
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
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'easy' THEN q.question_id END) AS easy_count,
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'medium' THEN q.question_id END) AS medium_count,
      COUNT(DISTINCT CASE WHEN q.difficulty_level = 'hard' THEN q.question_id END) AS difficult_count,
      ${studentId ? `
        COUNT(DISTINCT sq.question_id) AS attempted_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' THEN sq.question_id END) AS wrong_count,
        COUNT(DISTINCT CASE WHEN q.question_id IS NOT NULL AND sq.question_id IS NULL THEN q.question_id END) AS unsolved_count,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL THEN q.question_id END) AS marked_count,
        -- Correct counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'easy' THEN q.question_id END) AS correct_count_easy,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'medium' THEN q.question_id END) AS correct_count_medium,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '1' AND q.difficulty_level = 'hard' THEN q.question_id END) AS correct_count_hard,
        -- Wrong counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'easy' THEN q.question_id END) AS wrong_count_easy,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'medium' THEN q.question_id END) AS wrong_count_medium,
        COUNT(DISTINCT CASE WHEN sq.is_correct = '0' AND q.difficulty_level = 'hard' THEN q.question_id END) AS wrong_count_hard,
        -- Unused counts by difficulty
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'easy' THEN q.question_id END) AS unused_count_easy,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'medium' THEN q.question_id END) AS unused_count_medium,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'hard' THEN q.question_id END) AS unused_count_hard,
        -- Marked counts by difficulty
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'easy' THEN q.question_id END) AS marked_count_easy,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'medium' THEN q.question_id END) AS marked_count_medium,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND q.difficulty_level = 'hard' THEN q.question_id END) AS marked_count_hard
      ` : `
        0 AS attempted_count,
        0 AS correct_count,
        0 AS wrong_count,
        COUNT(DISTINCT q.question_id) AS unsolved_count,
        0 AS marked_count,
        -- Correct counts by difficulty (all 0 when no student)
        0 AS correct_count_easy,
        0 AS correct_count_medium,
        0 AS correct_count_hard,
        -- Wrong counts by difficulty (all 0 when no student)
        0 AS wrong_count_easy,
        0 AS wrong_count_medium,
        0 AS wrong_count_hard,
        -- Unused counts by difficulty (same as total counts when no student)
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'easy' THEN q.question_id END) AS unused_count_easy,
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'medium' THEN q.question_id END) AS unused_count_medium,
        COUNT(DISTINCT CASE WHEN q.difficulty_level = 'hard' THEN q.question_id END) AS unused_count_hard,
        -- Marked counts by difficulty (all 0 when no student)
        0 AS marked_count_easy,
        0 AS marked_count_medium,
        0 AS marked_count_hard
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
      q.difficulty_level,
      CASE WHEN sq.question_id IS NOT NULL THEN 1 ELSE 0 END AS attempted,
      CASE WHEN sq.is_correct = '1' THEN 1 ELSE 0 END AS correct,
      CASE WHEN mcq.question_id IS NOT NULL AND smc.student_mark_category_id IS NOT NULL THEN 1 ELSE 0 END AS marked
    FROM questions q
    LEFT JOIN (
      SELECT s1.question_id, s1.is_correct
      FROM solved_questions s1
      INNER JOIN (
        SELECT question_id, MAX(created_at) AS max_created
        FROM solved_questions
        WHERE student_id = ?
        GROUP BY question_id
      ) latest ON latest.question_id = s1.question_id AND latest.max_created = s1.created_at
      WHERE s1.student_id = ?
    ) sq ON sq.question_id = q.question_id
    LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id
    LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?
    WHERE q.topic_id IN (${topicPlaceholders})
    `,
    [studentId, studentId, studentId, ...topicIds]
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
      difficulty: q.difficulty,
      attempted: !!q.attempted,
      correct: !!q.correct,
      marked: !!q.marked
    });
  });

  // --- 4. Combine and return ---
  return topicRows.map(topic => {
    const distinct = [
      ...new Map(questionsByTopic[topic.topic_id].map(item => [item.question_id, item])).values()
    ];

    topic.wrong_count = distinct?.filter(item => !item?.correct && item?.attempted)?.length || 0;
    topic.correct_count = distinct?.filter(item => item?.correct && item?.attempted)?.length || 0;
    topic.unsolved_count = distinct?.filter(item => !item?.attempted)?.length || 0;
    topic.marked_count = distinct?.filter(item => item?.marked)?.length || 0;

    return ({
      ...topic,
      questions: distinct || []
    })
  })
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

// Study dashboard overview for UI widgets
async function getDashboardOverview({ studentId }) {
  // Get active study plan
  const today = new Date().toISOString().split('T')[0];
  const [plans] = await client.execute(
    `SELECT * FROM student_study_plans 
     WHERE student_id = ? AND status = 'active' 
     ORDER BY updated_at DESC LIMIT 1`,
    [studentId]
  );

  const activePlan = plans.length > 0 ? plans[0] : null;

  // Get questions answered stats
  const [questionsStats] = await client.execute(
    `SELECT 
       COUNT(*) as total_answered,
       SUM(CASE WHEN is_correct = '1' THEN 1 ELSE 0 END) as total_correct
     FROM solved_questions
     WHERE student_id = ?`,
    [studentId]
  );

  // Get study time stats
  const [studyTimeStats] = await client.execute(
    `SELECT 
       SUM(time_spent) as total_time_spent
     FROM student_plan_sessions
     WHERE plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)`,
    [studentId]
  );

  // Get exam date (if available)
  const [examInfo] = await client.execute(
    `SELECT 
       MIN(scheduled_date) as next_exam_date
     FROM exams e
     INNER JOIN student_enrollments se ON se.module_id = e.subject_id
     WHERE se.student_id = ? 
       AND e.scheduled_date >= CURRENT_DATE()
       AND e.status = 'active'
     LIMIT 1`,
    [studentId]
  );

  // Get current plan progress
  const currentPlanProgress = activePlan ? {
    completed: 0,
    total: 0
  } : { completed: 0, total: 0 };

  if (activePlan) {
    const [sessionStats] = await client.execute(
      `SELECT 
         COUNT(*) as total_sessions,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions
       FROM student_plan_sessions
       WHERE plan_id = ?`,
      [activePlan.plan_id]
    );

    if (sessionStats.length > 0) {
      currentPlanProgress.completed = Number(sessionStats[0].completed_sessions) || 0;
      currentPlanProgress.total = Number(sessionStats[0].total_sessions) || 0;
    }
  }

  // Get healthcare mastery stats
  const [healthcareStats] = await client.execute(
    `SELECT 
       COUNT(DISTINCT t.topic_id) as total_topics,
       COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN t.topic_id END) as mastered_topics
     FROM topics t
     INNER JOIN questions q ON q.topic_id = t.topic_id
     LEFT JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ?
     INNER JOIN units u ON u.unit_id = t.unit_id
     INNER JOIN modules m ON m.module_id = u.module_id
     WHERE m.status = 'active' AND t.status = 'active'`,
    [studentId]
  );

  // Get recent activity from solved questions, flashcards, and exam attempts
  // First, get recent solved questions
  const [recentQuestions] = await client.execute(
    `SELECT 
       'Answered Question' as title,
       CONCAT(m.subject_name, ' - ', t.topic_name) as details,
       DATE_FORMAT(sq.created_at, '%h:%i %p') as time,
       CASE WHEN sq.is_correct = '1' THEN '10' ELSE '5' END as points,
       sq.created_at as activity_time
     FROM solved_questions sq
     INNER JOIN questions q ON q.question_id = sq.question_id
     INNER JOIN topics t ON t.topic_id = q.topic_id
     INNER JOIN units u ON u.unit_id = t.unit_id
     INNER JOIN modules m ON m.module_id = u.module_id
     WHERE sq.student_id = ?
     ORDER BY sq.created_at DESC
     LIMIT 5`,
    [studentId]
  );

  // Get recent flashcard activity
  const [recentFlashcards] = await client.execute(
    `SELECT 
       'Studied Flashcard' as title,
       CONCAT(m.subject_name, ' - ', t.topic_name) as details,
       DATE_FORMAT(sfc.solved_at, '%h:%i %p') as time,
       CASE WHEN sfc.card_solved = '1' THEN '5' ELSE '2' END as points,
       sfc.solved_at as activity_time
     FROM student_flash_cards sfc
     INNER JOIN flashcards f ON f.flashcard_id = sfc.student_flash_card_id
     INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
     INNER JOIN topics t ON t.topic_id = f.topic_id
     INNER JOIN units u ON u.unit_id = t.unit_id
     INNER JOIN modules m ON m.module_id = u.module_id
     WHERE sd.student_id = ?
     ORDER BY sfc.solved_at DESC
     LIMIT 5`,
    [studentId]
  );

  // Get recent exam attempts
  const [recentExams] = await client.execute(
    `SELECT 
       'Took Exam' as title,
       e.title as details,
       DATE_FORMAT(ea.submitted_at, '%h:%i %p') as time,
       ROUND(ea.total_score * 10) as points,
       ea.submitted_at as activity_time
     FROM exam_attempts ea
     INNER JOIN exams e ON e.exam_id = ea.exam_id
     WHERE ea.student_id = ? AND ea.submitted_at IS NOT NULL
     ORDER BY ea.submitted_at DESC
     LIMIT 5`,
    [studentId]
  );

  // Get recent study sessions
  const [recentSessions] = await client.execute(
    `SELECT 
       'Study Session' as title,
       CASE 
         WHEN s.session_type = 'question_bank' THEN 'Practice Questions'
         WHEN s.session_type = 'flashcards' THEN 'Flashcard Study'
         ELSE 'General Study'
       END as details,
       DATE_FORMAT(s.updated_at, '%h:%i %p') as time,
       ROUND(s.time_spent / 60) as points,
       s.updated_at as activity_time
     FROM student_plan_sessions s
     WHERE s.plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)
       AND s.status = 'completed'
     ORDER BY s.updated_at DESC
     LIMIT 5`,
    [studentId]
  );

  // Combine all activities, sort by time, and take the 5 most recent
  const allActivities = [
    ...recentQuestions,
    ...recentFlashcards,
    ...recentExams,
    ...recentSessions
  ]
    .sort((a, b) => new Date(b.activity_time) - new Date(a.activity_time))
    .slice(0, 5)
    .map(a => ({
      title: a.title || "",
      details: a.details || "",
      time: a.time || "",
      points: a.points || ""
    }));

  // Get upcoming deadlines
  const [upcomingDeadlines] = await client.execute(
    `SELECT 
       e.title,
       DATE_FORMAT(e.scheduled_date, '%Y-%m-%d') as date,
       m.subject_name as course,
       CASE WHEN DATEDIFF(e.scheduled_date, CURRENT_DATE()) <= 3 THEN 1 ELSE 0 END as urgent
     FROM exams e
     INNER JOIN modules m ON m.module_id = e.subject_id
     INNER JOIN student_enrollments se ON se.module_id = e.subject_id
     WHERE se.student_id = ? 
       AND e.scheduled_date >= CURRENT_DATE()
       AND e.status = 'active'
     ORDER BY e.scheduled_date ASC
     LIMIT 5`,
    [studentId]
  );

  // Calculate days until exam
  const nextExamDate = examInfo.length > 0 && examInfo[0].next_exam_date
    ? new Date(examInfo[0].next_exam_date)
    : null;

  const daysUntilExam = nextExamDate
    ? Math.max(0, Math.ceil((nextExamDate - new Date()) / (1000 * 60 * 60 * 24)))
    : 30; // Default to 30 days if no exam scheduled

  // Calculate accuracy
  const questionsAnswered = Number(questionsStats[0]?.total_answered) || 0;
  const questionsCorrect = Number(questionsStats[0]?.total_correct) || 0;
  const accuracy = questionsAnswered > 0 ? Math.round((questionsCorrect / questionsAnswered) * 100) : 0;

  // Calculate hours studied
  const totalMinutesStudied = Math.round((Number(studyTimeStats[0]?.total_time_spent) || 0) / 60);
  const hoursStudied = Math.round(totalMinutesStudied / 60 * 10) / 10; // Round to 1 decimal place

  // Build response object
  return {
    currentPlan: currentPlanProgress,
    healthcareMastered: {
      completed: Number(healthcareStats[0]?.mastered_topics) || 0,
      total: Number(healthcareStats[0]?.total_topics) || 0
    },
    studyBreak: null, // This could be calculated based on session gaps if needed
    recentActivity: allActivities,
    upcomingDeadlines: upcomingDeadlines.map(d => ({
      title: d.title || "",
      date: d.date || "",
      course: d.course || "",
      urgent: Boolean(d.urgent)
    })),
    stats: {
      questionsAnswered,
      hoursStudied,
      accuracy,
      daysUntilExam
    }
  };
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