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
  question_mode,
  flashcardsModules,
  booksIndeces,
  exams_modules,
  qbank_modes,
  exams,
  question_level = ["easy", "medium", "hard"]
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
    question_mode,
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
    exams ? JSON.stringify(exams) : null
  ];
  const [result] = await client.execute(sql, params);

  let totalQuestions = 0;
  if (questionBankTopics && questionBankTopics.length > 0) {
    const topicPlaceholders = questionBankTopics.map(() => "?").join(",");
    let countSql = `SELECT COUNT(DISTINCT q.question_id) as total 
                    FROM questions q 
                    WHERE q.topic_id IN (${topicPlaceholders})`;

    const countParams = [...questionBankTopics];

    const [countResult] = await client.execute(countSql, countParams);
    totalQuestions = countResult[0]?.total || 0;
  }

  const availableDates = getDatesBetween(startDate, endDate, studyDays, {
    locale: "en-US",
    timeZone: "Africa/Cairo"
  });

  console.log("availableDates", dailyLimits?.max_questions);

  let questionsPerDate = [];
  let datesToUse = [];
  let remainingQuestions = totalQuestions;

  if (
    totalQuestions > 0 &&
    availableDates.length > 0 &&
    questionsPerSession > 0
  ) {

    const dailyQuestionLimit = dailyLimits?.max_questions
      ? Number(dailyLimits.max_questions)
      : null;

    datesToUse = [];
    questionsPerDate = [];

    for (const date of availableDates) {
      if (remainingQuestions <= 0) break;


      const dayCapacity =
        dailyQuestionLimit && dailyQuestionLimit > 0
          ? Math.min(dailyQuestionLimit, remainingQuestions)
          : Math.min(questionsPerSession, remainingQuestions);


      let toAllocate = dayCapacity;
      while (toAllocate > 0 && remainingQuestions > 0) {
        const sessionSize = Math.min(
          questionsPerSession,
          toAllocate,
          remainingQuestions
        );
        datesToUse.push(date);
        questionsPerDate.push(sessionSize);
        remainingQuestions -= sessionSize;
        toAllocate -= sessionSize;
      }
    }
  } else if (availableDates.length > 0) {
    datesToUse = availableDates;
    questionsPerDate = availableDates.map(() => 0);
  }

  console.log(`Dates To Use:`, datesToUse);
  const qbankId = await Promise.all(
    datesToUse.map(async (date, index) => {
      const numQuestions = questionsPerDate[index] || 0;
      console.log(`Questions distribution per day:`, numQuestions);

      if (numQuestions > 0) {
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
          numQuestions: numQuestions,
          question_mode: qbank_modes,
          qbank_modes: qbank_modes
        });
      }
      return null;
    })
  );
  await Promise.all(
    availableDates.map(async (date, index) => {
      const safeValue = (value) => {
        if (value === undefined || value === null) return null;
        if (Array.isArray(value)) return null;
        if (typeof value === "number" && !isNaN(value)) return value;
        if (typeof value === "string" && value !== "") return value;
        return null;
      };

      const getArrayValue = (arr, idx) => {
        if (!arr || !Array.isArray(arr)) return null;
        const val = arr[idx];
        return safeValue(val);
      };

      const qbankIdForThisDate = index < qbankId.length ? qbankId[index] : null;

      await createSession({
        planId: result.insertId,
        studentId: studentId,
        studyDay: index + 1,
        studyDayDate: date?.date || null,
        studyDayName: date?.day?.substring(0, 3) || null,
        qbankId: safeValue(qbankIdForThisDate),
        examId: getArrayValue(exams, index),
        flashcarddeckId: getArrayValue(flashcardsDecks, index),
        ebookId: safeValue(books),
        indexId: getArrayValue(booksIndeces, index)
      });

      await createCalenderSessionScheduling({
        studentId,
        title:
          "Session Of Day - " +
          `${date?.date} - ${date?.day}` +
          " - For Plan:  " +
          planName,
        scheduledDate: date?.date ? date.date.split("T")[0] : null,
        timeOfDay:
          date?.date && date.date.includes("T")
            ? (date.date.split("T")[1] || "").slice(0, 5) || null
            : null,
        taskType: "Session",
        priority: "Medium",
        notes: "Not Found"
      });
    })
  );

  return { plan_id: result.insertId };
}

const createCalenderSessionScheduling = async ({
  studentId,
  title,
  scheduledDate,
  timeOfDay,
  taskType,
  priority,
  notes
}) => {
  const safeTimeOfDay =
    typeof timeOfDay === "string" && timeOfDay.trim() !== ""
      ? timeOfDay
      : "09:00";
  const safeScheduledDate =
    typeof scheduledDate === "string" && scheduledDate.trim() !== ""
      ? scheduledDate
      : new Date().toISOString().slice(0, 10);
  const sql = `INSERT INTO student_tasks_backlog (student_id, title, time_of_day, task_type, priority, notes)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    studentId,
    title,
    safeTimeOfDay,
    taskType,
    priority,
    notes || null
  ];
  const [result] = await client.execute(sql, params);
  const [backlogTask] = await client.execute(
    "SELECT time_of_day FROM student_tasks_backlog WHERE backlog_task_id = ? AND student_id = ?",
    [result?.insertId, studentId]
  );

  if (!backlogTask || backlogTask.length === 0) {
    throw new Error("Backlog task not found");
  }

  const sql2 = `INSERT INTO student_task_schedule (student_id, backlog_task_id, scheduled_date, start_time)
               VALUES (?, ?, ?, ?)`;
  const params2 = [
    studentId,
    result?.insertId,
    safeScheduledDate,
    backlogTask[0].time_of_day
  ];
  const [result2] = await client.execute(sql2, params2);
};

const createSession = async ({
  planId,
  studentId,
  studyDay,
  studyDayName,
  qbankId,
  examId,
  flashcarddeckId,
  ebookId,
  indexId,
  studyDayDate
}) => {
  const cleanValue = (v, isNumericField = false) => {
    if (v === undefined || v === null) return null;
    if (Array.isArray(v)) return null;
    if (v === "" && !isNumericField) return null;
    if (typeof v === "number" && isNaN(v)) return null;
    return v;
  };

  const paramsSafe = [
    cleanValue(planId, true),
    cleanValue(studentId, true),
    cleanValue(studyDay, true),
    cleanValue(studyDayName, false),
    cleanValue(qbankId, true),
    cleanValue(examId, true),
    cleanValue(flashcarddeckId, true),
    cleanValue(ebookId, true),
    cleanValue(indexId, true),
    cleanValue(studyDayDate, false)
  ];

  const sql = `INSERT INTO new_student_plan_sessions (plan_id, student_id, study_day, study_day_name, qbank_id, exam_id, flashcarddeck_id, ebook_id, index_id, study_day_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await client.execute(sql, paramsSafe);
  return result.insertId;
};

async function generatePlanSessions({ planId, studentId, studyDaysNumbers }) {
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) throw new Error("Plan not found");

  let study_days;
  if (Array.isArray(plan.study_days)) {
    study_days = plan.study_days;
  } else if (typeof plan.study_days === "string") {
    try {
      const parsed = JSON.parse(plan.study_days);
      study_days = Array.isArray(parsed)
        ? parsed
        : plan.study_days
          ? plan.study_days.split(",")
          : [];
    } catch {
      study_days = plan.study_days ? plan.study_days.split(",") : [];
    }
  } else {
    study_days = [];
  }

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
    exams: safeParse(plan.exams)
  };

  const normalizeToArray = (val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    return [val];
  };

  parsedPlan.questionBankModules = normalizeToArray(
    parsedPlan.questionBankModules
  );
  parsedPlan.questionBankTopics = normalizeToArray(
    parsedPlan.questionBankTopics
  );
  parsedPlan.questionBankSubject = normalizeToArray(
    parsedPlan.questionBankSubject
  );
  parsedPlan.booksModule = normalizeToArray(parsedPlan.booksModule);
  parsedPlan.booksIndeces = normalizeToArray(parsedPlan.booksIndeces);
  parsedPlan.books = normalizeToArray(parsedPlan.books);
  parsedPlan.flashcardsDecks = normalizeToArray(parsedPlan.flashcardsDecks);
  parsedPlan.flashcardsModules = normalizeToArray(parsedPlan.flashcardsModules);
  parsedPlan.exams = normalizeToArray(parsedPlan.exams);

  const contentRowsByType = {};

  const insertContentRow = async ({
    examsModules = null,
    examsTopics = null,
    flashcardsModules = null,
    flashcardsTopics = null,
    questionBankModules = null,
    questionBankTopics = null,
    questionBankQuizzes = null,
    subjects = null
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
      subjects ? JSON.stringify(subjects) : JSON.stringify(["all"])
    ];
    const [ins] = await client.execute(sql, params);
    return ins.insertId;
  };

  const availableTypes = [];
  if (
    parsedPlan.questionBankModules.length > 0 ||
    parsedPlan.questionBankTopics.length > 0
  ) {
    contentRowsByType.question_bank = await insertContentRow({
      questionBankModules: parsedPlan.questionBankModules,
      questionBankTopics: parsedPlan.questionBankTopics,
      questionBankQuizzes: null,
      subjects: parsedPlan.questionBankSubject
    });
    availableTypes.push("question_bank");
  }
  if (
    parsedPlan.flashcardsModules.length > 0 ||
    parsedPlan.flashcardsTopics.length > 0
  ) {
    contentRowsByType.flashcards = await insertContentRow({
      flashcardsModules: parsedPlan.flashcardsModules,
      flashcardsTopics: null
    });
    availableTypes.push("flashcards");
  }
  if (parsedPlan.books.length > 0 || parsedPlan.booksModule.length > 0) {
    contentRowsByType.ebooks = await insertContentRow({
      subjects: parsedPlan.booksModule
    });
    availableTypes.push("ebooks");
  }
  if (parsedPlan.exams.length > 0) {
    contentRowsByType.exams = await insertContentRow({
      examsModules: parsedPlan.exams_modules || [],
      examsTopics: parsedPlan.exams_topics || []
    });
    availableTypes.push("exams");
  }

  const contentItems = availableTypes.map((t) => ({
    content_type: t,
    content_id: contentRowsByType[t]
  }));

  let studyDaysNumbersParsed = parsedPlan.study_days;
  if (typeof studyDaysNumbersParsed[0] === "string") {
    const dayMap = {
      Sun: 0,
      Sunday: 0,
      Mon: 1,
      Monday: 1,
      Tue: 2,
      Tuesday: 2,
      Wed: 3,
      Wednesday: 3,
      Thu: 4,
      Thursday: 4,
      Fri: 5,
      Friday: 5,
      Sat: 6,
      Saturday: 6
    };
    studyDaysNumbersParsed = studyDaysNumbersParsed.map((day) => {
      const d = String(day).trim();
      return dayMap[d] ?? Number(d);
    });
  }

  const insertSql = `INSERT INTO student_plan_sessions 
               (plan_id, session_date, session_type, content_id)
               VALUES (?, ?, ?, ?)`;
  const existsSql = `SELECT session_id FROM student_plan_sessions WHERE plan_id = ? AND session_date = ? AND session_type = ? LIMIT 1`;

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

    const item = contentItems[rotationIndex % contentItems.length];
    rotationIndex += 1;

    const [exists] = await client.execute(existsSql, [
      planId,
      dateStr,
      item.content_type
    ]);
    if (exists && exists.length) continue;

    const contentIdForType = item.content_id || null;
    const [result] = await client.execute(insertSql, [
      planId,
      dateStr,
      item.content_type,
      contentIdForType
    ]);
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
    daily_limits: row.daily_limits ? JSON.parse(row.daily_limits) : null
  }));
}

async function getStudyPlanById({ planId, studentId }) {
  const [rows] = await client.execute(
    `SELECT * FROM student_study_plans WHERE plan_id = ? AND student_id = ?`,
    [planId, studentId]
  );

  if (rows.length === 0) return null;

  const plan = rows[0];

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
      plan.end_date
    ]
  );

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

  const flashcardsTotals =
    flashcardsTotalRow && flashcardsTotalRow[0]
      ? {
        total_studied: Number(flashcardsTotalRow[0].total_studied) || 0,
        total_solved: Number(flashcardsTotalRow[0].total_solved) || 0
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
      by_deck: flashcardsByDeck
    }
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
  status
}) {
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

  if (updates.length === 0) return true;

  params.push(planId, studentId);
  const sql = `UPDATE student_study_plans SET ${updates.join(
    ", "
  )} WHERE plan_id = ? AND student_id = ?`;

  const [result] = await client.execute(sql, params);
  return result.affectedRows > 0;
}

async function deleteStudyPlan({ planId, studentId }) {

  await client.execute("START TRANSACTION");
  try {

    const [qbankRows] = await client.execute(
      `SELECT qbank_id FROM new_student_plan_sessions WHERE plan_id = ? AND qbank_id IS NOT NULL`,
      [planId]
    );
    const qbankIds = (qbankRows || [])
      .map((r) => r.qbank_id)
      .filter((id) => id != null);

    if (qbankIds.length) {
      const placeholders = qbankIds.map(() => "?").join(",");

      await client.execute(
        `DELETE FROM qbank_questions WHERE qbank_id IN (${placeholders})`,
        qbankIds
      );
      await client.execute(
        `DELETE FROM qbank WHERE qbank_id IN (${placeholders})`,
        qbankIds
      );
    }








    await client.execute(
      `DELETE FROM new_student_plan_sessions WHERE plan_id = ?`,
      [planId]
    );











    const [planDel] = await client.execute(
      `DELETE FROM student_study_plans WHERE plan_id = ? AND student_id = ?`,
      [planId, studentId]
    );

    await client.execute("COMMIT");
    return planDel.affectedRows > 0;
  } catch (err) {
    await client.execute("ROLLBACK");
    throw err;
  }
}

async function addPlanContent({
  planId,
  examsModules,
  examsTopics,
  flashcardsModules,
  flashcardsTopics,
  questionBankModules,
  questionBankTopics,
  questionBankQuizzes,
  subjects
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
    subjects ? JSON.stringify(subjects) : JSON.stringify(["all"])
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
    subjects: content.subjects
      ? JSON.parse(content.subjects)
      : JSON.stringify(["all"])
  };

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
  status = null
}) {
  let sql = `SELECT 
  nsps.*,
  COALESCE(
    JSON_ARRAYAGG(
      DISTINCT JSON_OBJECT(
  'qbank_id', q.qbank_id,
  'qbank_name', q.qbank_name,
  'qbank_created_at', q.created_at,
  'started', COALESCE(
    (SELECT id FROM new_student_plan_content WHERE content_type = 'qbank' AND content_id = q.qbank_id AND session_id = nsps.session_id LIMIT 1),
    0
  ),
  'progress',
  (
    SELECT 
      IFNULL(
        ROUND(
          (
            SELECT COUNT(DISTINCT sq.question_id) 
            FROM solved_questions sq
            WHERE sq.qbank_id = q.qbank_id AND sq.student_id = ? AND sq.is_correct = '1'
          ) 
          *
          100.0 /
          (
            SELECT COUNT(*) 
            FROM qbank_questions qq 
            WHERE qq.qbank_id = q.qbank_id
          )
          , 0
        ), 0
      )
  )
      )
    ),
    JSON_ARRAY()
) AS qbank,
  JSON_OBJECT(
    'exam_id', e.exam_id,
    'exam_name', e.title,
    'difficulty', e.difficulty,
    'exam_created_at', e.created_at,
    'started', COALESCE((SELECT new_student_plan_content.id FROM new_student_plan_content WHERE content_type = 'exam' AND content_id = e.exam_id AND session_id = nsps.session_id LIMIT 1), 0) 
  ) AS exams,
  JSON_OBJECT(
    'flashcarddeck_id', fl.library_id,
    'flashcarddeck_name', fl.library_name,
    'flashcarddeck_description', fl.description,
    'flashcarddeck_created_at', fl.created_at,
    'started', COALESCE((SELECT new_student_plan_content.id FROM new_student_plan_content WHERE content_type = 'flashcard' AND content_id = fl.library_id AND session_id = nsps.session_id LIMIT 1), 0)
  ) AS flashcards_decks,
   JSON_OBJECT(
    'ebook_id', eb.ebook_id,
    'ebook_name', eb.book_title,
    'ebook_description', eb.book_description,
    'ebook_created_at', eb.created_at,
    'index_id', ei.ebook_index_id,
    'index_title', ei.index_title,
    'index_page', ei.page_number,
    'index_order', ei.order_index,
    'started', COALESCE((SELECT new_student_plan_content.id FROM new_student_plan_content WHERE content_type = 'ebook' AND content_id = eb.ebook_id AND session_id = nsps.session_id LIMIT 1), 0)
  ) AS ebooks
             FROM new_student_plan_sessions AS nsps
             LEFT JOIN qbank AS q ON nsps.qbank_id = q.qbank_id AND DATE(q.date_schedule) <= CURDATE()
             LEFT JOIN exams AS e ON nsps.exam_id = e.exam_id
             LEFT JOIN flashcard_libraries AS fl ON nsps.flashcarddeck_id = fl.library_id
             LEFT JOIN ebooks AS eb ON nsps.ebook_id = eb.ebook_id
             LEFT JOIN ebook_indeces AS ei ON nsps.index_id = ei.ebook_index_id
             WHERE 1 = 1 `;


  let params = [studentId];


  if (date !== null && date !== undefined) {
    sql += ` AND DATE(nsps.study_day_date) = DATE(?)`;
    params.push(date);
  }

  if (planId) {
    sql += ` AND nsps.plan_id = ? AND nsps.student_id = ?`;
    params.push(planId);
    params.push(studentId);
  } else {
    sql += ` AND nsps.student_id = ?`;
    params.push(studentId);
  }


  if (status) {
    sql += ` AND nsps.status = ?`;
    params.push(status);
  }

  sql += ` GROUP BY nsps.plan_id`;

  const [rows] = await client.execute(sql, params);
  rows.map((item) => {
    item.flashcards_decks = JSON.parse(item.flashcards_decks);
    item.exams = JSON.parse(item.exams);
    item.qbank = JSON.parse(item.qbank);
    item.ebooks = JSON.parse(item.ebooks);
    item.ebooks = item.ebooks?.ebook_id ? item.ebooks : {};
    item.ebooks = item.ebooks?.index_id ? item.ebooks : {};
    item.flashcards_decks = item.flashcards_decks?.flashcarddeck_id
      ? item.flashcards_decks
      : {};
    item.exams = item.exams?.exam_id ? item.exams : {};
    item.qbank = item.qbank?.length
      ? item.qbank?.filter((item) => item?.qbank_id)
      : [];
    return item;
  });
  return rows.map((item) => {
    return {
      ...item,
      ebooks: item.ebooks?.ebook_id ? item.ebooks : {}
    };
  });
}

const startSessionContent = async ({
  planId,
  studentId,
  sessionId,
  contentType,
  contentId
}) => {
  const sql = `INSERT INTO new_student_plan_content (plan_id, student_id, session_id, content_type, content_id, progress) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [planId, studentId, sessionId, contentType, contentId, 0];
  const [result] = await client.execute(sql, params);
  return result.insertId;
};

/**
 ebook_index_id, ebook_id, parent_id, level, order_index, index_title, page_number, created_at
 */

async function getSessionDetails({ planId, studentId, sessionId }) {
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

  const [planRows] = await client.execute(
    `SELECT questions_per_session, daily_limits FROM student_study_plans WHERE plan_id = ? LIMIT 1`,
    [planId]
  );
  const planRow =
    planRows && planRows[0]
      ? planRows[0]
      : { questions_per_session: 20, daily_limits: null };
  const dailyLimits = planRow.daily_limits
    ? JSON.parse(planRow.daily_limits)
    : {};
  const questionsGoalPerSession = Number(planRow.questions_per_session) || 20;
  const flashcardsGoalPerSession = Number(dailyLimits.max_flashcards) || 50;

  const qbModules = session.question_bank_modules
    ? JSON.parse(session.question_bank_modules)
    : [];
  const qbTopics = session.question_bank_topics
    ? JSON.parse(session.question_bank_topics)
    : [];
  const flashModules = session.flashcards_modules
    ? JSON.parse(session.flashcards_modules)
    : [];
  const flashTopics = session.flashcards_topics
    ? JSON.parse(session.flashcards_topics)
    : [];

  let whereQ = ["q.status = 'active'"];
  const valuesQ = [];
  if (qbTopics.length) {
    whereQ.push(`q.topic_id IN (${qbTopics.map(() => "?").join(",")})`);
    valuesQ.push(...qbTopics);
  } else if (qbModules.length) {
    whereQ.push(`u.module_id IN (${qbModules.map(() => "?").join(",")})`);
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
${whereQ.length ? `WHERE ${whereQ.join(" AND ")}` : ""}
GROUP BY q.question_id
ORDER BY q.created_at DESC
LIMIT ${questionsGoalPerSession}`;

  const [questionRows] = await client.execute(questionsSql, [
    studentId,
    ...valuesQ
  ]);

  for (const q of questionRows) {
    try {
      if (typeof q.options === "string")
        q.options = JSON.parse(q.options).filter(Boolean);
      if (typeof q.notes === "string")
        q.notes = JSON.parse(q.notes).filter(Boolean);
      const answerParsed = JSON.parse(q.your_answer || "{}");
      answerParsed.solved = answerParsed?.is_correct != null;
      q.your_answer = answerParsed;
      q.tags = JSON.parse(q.tags).filter(Boolean);
      if (typeof q.flashcards === "string") {
        const parsed = JSON.parse(q.flashcards).filter(Boolean);
        for (const fc of parsed) {
          if (typeof fc.tags === "string") {
            try {
              fc.tags = JSON.parse(fc.tags);
            } catch { }
          }
        }
        q.flashcards = parsed;
      }
    } catch { }
  }

  const limitedQuestions = questionRows.slice(0, questionsGoalPerSession);

  let whereF = ["f.status IN ('active','draft')"];
  const valuesF = [];
  if (flashTopics.length) {
    whereF.push(`f.topic_id IN (${flashTopics.map(() => "?").join(",")})`);
    valuesF.push(...flashTopics);
  } else if (flashModules.length) {
    whereF.push(`u.module_id IN (${flashModules.map(() => "?").join(",")})`);
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
    ${whereF.length ? `WHERE ${whereF.join(" AND ")}` : ""}
    ORDER BY f.card_order, f.flashcard_id 
    LIMIT ${flashcardsGoalPerSession}`;

  const [flashcardRows] = await client.execute(flashcardsSql, [
    studentId,
    ...valuesF
  ]);

  const totalQuestions = limitedQuestions.length;
  const questionsAttempted = limitedQuestions.reduce(
    (a, q) => a + (q.your_answer?.solved ? 1 : 0),
    0
  );
  const questionsCorrect = limitedQuestions.reduce(
    (a, q) => a + (q.your_answer?.is_correct ? 1 : 0),
    0
  );
  const questionProgress = totalQuestions
    ? Math.round((questionsAttempted / totalQuestions) * 100)
    : 0;

  const totalFlashcards = flashcardRows.length;
  const flashcardsStudied = flashcardRows.reduce(
    (a, c) => a + (c.attempts > 0 ? 1 : 0),
    0
  );
  const flashcardsCorrect = flashcardRows.reduce(
    (a, c) => a + (c.correct > 0 ? 1 : 0),
    0
  );
  const flashcardsProgress = totalFlashcards
    ? Math.round((flashcardsStudied / totalFlashcards) * 100)
    : 0;

  return {
    session: {
      session_id: session.session_id,
      session_date: session.session_date,
      session_type: session.session_type,
      status: session.status
    },
    questions: limitedQuestions,
    flashcards: flashcardRows,
    limits: {
      questions_limit: questionsGoalPerSession,
      flashcards_limit: flashcardsGoalPerSession
    },
    progress: {
      questions: {
        attempted: questionsAttempted,
        correct: questionsCorrect,
        total: totalQuestions,
        progress_percent: questionProgress
      },
      flashcards: {
        studied: flashcardsStudied,
        correct: flashcardsCorrect,
        total: totalFlashcards,
        progress_percent: flashcardsProgress
      }
    }
  };
}

async function solveSessionQuestion({
  planId,
  sessionId,
  studentId,
  questionId,
  selectedOptionId = null,
  answerText = null
}) {

  const [sessions] = await client.execute(
    `SELECT session_id, qbank_id, plan_id
     FROM new_student_plan_sessions
     WHERE session_id = ? AND plan_id = ?
     LIMIT 1`,
    [sessionId, planId]
  );
  if (!sessions.length) return { success: false, message: "Session not found" };
  const session = sessions[0];
  const qbankId = session.qbank_id || null;


  if (qbankId) {
    const [qCheck] = await client.execute(
      `SELECT qq.question_id 
       FROM qbank_questions qq
       WHERE qq.qbank_id = ? AND qq.question_id = ?
       LIMIT 1`,
      [qbankId, questionId]
    );
    if (!qCheck.length)
      return { success: false, message: "Question not in session qbank" };
  }

  let isCorrect = 0;
  if (selectedOptionId) {
    const [optRows] = await client.execute(
      `SELECT is_correct FROM question_options WHERE option_id = ? AND question_id = ? LIMIT 1`,
      [selectedOptionId, questionId]
    );
    isCorrect =
      optRows.length &&
        (optRows[0].is_correct === 1 || optRows[0].is_correct === "1")
        ? 1
        : 0;
  } else if (answerText != null) {
    const [optRows] = await client.execute(
      `SELECT is_correct FROM question_options WHERE question_id = ? AND option_text = ? LIMIT 1`,
      [questionId, answerText]
    );
    isCorrect =
      optRows.length &&
        (optRows[0].is_correct === 1 || optRows[0].is_correct === "1")
        ? 1
        : 0;
  }


  await client.execute(
    `INSERT INTO solved_questions (question_id, student_id, answer, is_correct, qbank_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [
      questionId,
      studentId,
      answerText || String(selectedOptionId || ""),
      isCorrect ? "1" : "0",
      qbankId
    ]
  );

  try {
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
        activityDescription: `Answered question in study session: ${question.question_text.substring(
          0,
          50
        )}...`,
        moduleName: null,
        topicName: null,
        scorePercentage: isCorrect ? 100 : 0,
        pointsEarned: isCorrect ? 10 : 0,
        metadata: {
          question_id: questionId,
          session_id: sessionId,
          plan_id: planId,
          answer: answerText || String(selectedOptionId || ""),
          is_correct: isCorrect,
          question_type: question.question_type,
          difficulty_level: question.difficulty_level,
          context: "study_session"
        }
      });
    }
  } catch (activityError) {
    console.error(
      "Failed to log activity for session question solve:",
      activityError
    );
  }

  return { success: true, attempted: 1, correct: isCorrect };
}

async function reviewSessionFlashcard({
  planId,
  sessionId,
  studentId,
  flashcardId,
  correct = false,
  status = "seen"
}) {
  const [sessions] = await client.execute(
    `SELECT s.session_id, c.flashcards_modules, c.flashcards_topics
     FROM student_plan_sessions s
     JOIN student_plan_content c ON c.content_id = s.content_id
     WHERE s.session_id = ? AND s.plan_id = ?
     LIMIT 1`,
    [sessionId, planId]
  );
  if (!sessions.length) return { success: false, message: "Session not found" };
  const session = sessions[0];

  const flashModules = session.flashcards_modules
    ? JSON.parse(session.flashcards_modules)
    : [];
  const flashTopics = session.flashcards_topics
    ? JSON.parse(session.flashcards_topics)
    : [];

  let fCheckSql = `SELECT f.flashcard_id FROM flashcards f`;
  const fWhere = [];
  const fVals = [flashcardId];
  if (flashTopics.length) {
    fWhere.push(`f.topic_id IN (${flashTopics.map(() => "?").join(",")})`);
    fVals.push(...flashTopics);
  } else if (flashModules.length) {
    fCheckSql += ` INNER JOIN topics t ON t.topic_id = f.topic_id INNER JOIN units u ON u.unit_id = t.unit_id`;
    fWhere.push(`u.module_id IN (${flashModules.map(() => "?").join(",")})`);
    fVals.push(...flashModules);
  }
  const [fCheck] = await client.execute(
    `${fCheckSql} WHERE f.flashcard_id = ? ${fWhere.length ? " AND " + fWhere.join(" AND ") : ""
    } LIMIT 1`,
    fVals
  );
  if (!fCheck.length)
    return { success: false, message: "Flashcard not in session scope" };

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

  await client.execute(
    `UPDATE student_plan_sessions 
     SET flashcards_studied = COALESCE(flashcards_studied,0) + 1
     WHERE session_id = ? AND plan_id = ?`,
    [sessionId, planId]
  );

  try {
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
        activityDescription: `Studied flashcard: ${flashcard.front_text.substring(
          0,
          50
        )}...`,
        moduleName: null,
        topicName: null,
        scorePercentage: correct ? 100 : 0,
        pointsEarned: correct ? 5 : 0,
        metadata: {
          flashcard_id: flashcardId,
          session_id: sessionId,
          plan_id: planId,
          is_correct: correct,
          status: status,
          difficulty_level: flashcard.difficulty_level,
          context: "study_session"
        }
      });
    }
  } catch (activityError) {
    console.error(
      "Failed to log activity for flashcard review:",
      activityError
    );
  }

  return { success: true, studied: 1, correct: correct ? 1 : 0 };
}

async function getSessionsWithSchedule({ planId, studentId }) {
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) return null;

  const sessions = await getPlanSessions({ planId, studentId });
  const summary = await getPlanSummary({ planId, studentId });

  const sessionsByDate = {};
  sessions.forEach((session) => {
    const date = session.session_date;
    if (!sessionsByDate[date]) {
      sessionsByDate[date] = [];
    }
    sessionsByDate[date].push(session);
  });

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
      sessions_count: daySessions.length
    });
  }

  return {
    summary: summary,
    daily_schedule: dailySchedule,
    total_sessions: sessions.length
  };
}

async function getTodayOverview({ studentId }) {
  const today = new Date().toISOString().split("T")[0];




  const [activityDatesFromLog] = await client.execute(
    `SELECT DISTINCT DATE(created_at) as activity_date
     FROM student_activity_log 
     WHERE student_id = ? 
     ORDER BY activity_date DESC 
     LIMIT 30`,
    [studentId]
  );


  let activityDates = [...activityDatesFromLog];
  try {
    const [dailyActivityDates] = await client.execute(
      `SELECT DISTINCT DATE(activity_date) as activity_date
       FROM student_daily_activity 
       WHERE student_id = ? 
       ORDER BY activity_date DESC 
       LIMIT 30`,
      [studentId]
    );

    const existingDates = new Set(
      activityDates.map((d) => String(d.activity_date).split("T")[0])
    );
    dailyActivityDates.forEach((d) => {
      const dateStr = String(d.activity_date).split("T")[0];
      if (!existingDates.has(dateStr)) {
        activityDates.push(d);
        existingDates.add(dateStr);
      }
    });
  } catch (err) {

  }


  const todayIncluded = activityDates.some(
    (row) => String(row.activity_date).split("T")[0] === today
  );
  if (!todayIncluded) {
    activityDates.unshift({ activity_date: today });
  }


  activityDates.sort((a, b) => {
    const dateA = new Date(String(a.activity_date).split("T")[0]);
    const dateB = new Date(String(b.activity_date).split("T")[0]);
    return dateB - dateA;
  });


  let streak = 0;
  if (activityDates && activityDates.length > 0) {
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);


    for (let i = 0; i < activityDates.length; i++) {
      const rowDate = activityDates[i].activity_date;
      const activityDate =
        rowDate instanceof Date
          ? new Date(rowDate)
          : new Date(String(rowDate).split("T")[0]);
      activityDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(todayDate);
      expectedDate.setDate(todayDate.getDate() - i);

      if (activityDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }
  }

  const [plans] = await client.execute(
    `SELECT * FROM student_study_plans 
     WHERE student_id = ? AND status = 'active' 
       AND start_date <= ? AND end_date >= ?
     ORDER BY updated_at DESC LIMIT 1`,
    [studentId, today, today]
  );
  if (!plans.length) {
    return {
      streak,
      tasks: [],
      stats: {
        study_time_minutes: 0,
        questions_today: { attempted: 0, correct: 0, goal: 0 },
        flashcards_today: { studied: 0, accuracy_percent: 0 },
        completion_percentage: 0
      },
      recent_sessions: []
    };
  }
  const plan = plans[0];



  const sessions = await getPlanSessions({

    studentId,
    date: null,
    status: null
  });
  console.log("sessions", sessions);

  const sessionsToday = (sessions || []).filter((s) => {
    const sessionDate = s.study_day_date || s.session_date;
    if (!sessionDate) return false;


    const sessionDateStr =
      sessionDate instanceof Date
        ? sessionDate.toISOString().split("T")[0]
        : String(sessionDate).split("T")[0];

    return sessionDateStr === today;
  });



  const dailyLimits = plan.daily_limits ? JSON.parse(plan.daily_limits) : {};
  const questionsGoalPerSession = Number(plan.questions_per_session) || 20;
  const flashcardsGoalPerSession = Number(dailyLimits.max_flashcards) || 50;

  const sessionsCount = sessionsToday.length || 1;
  const minutesPerSession = Math.max(
    10,
    Math.round((Number(plan.daily_time_budget) || 60) / sessionsCount)
  );

  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalStudied = 0;
  let totalFlashCorrect = 0;
  let completedCount = 0;
  let studyTimeMinutes = 0;


  const todayQbankIds = [];
  sessionsToday.forEach((s) => {
    const qbanks = Array.isArray(s.qbank)
      ? s.qbank
      : s.qbank?.qbank_id
        ? [s.qbank]
        : [];
    qbanks.forEach((q) => {
      if (q?.qbank_id) {
        todayQbankIds.push(q.qbank_id);
      }
    });
  });




  let questionsStatsToday = { attempted: 0, correct: 0 };




  const todayFlashcardLibraryIds = [];
  sessionsToday.forEach((s) => {
    if (s.flashcards_decks && s.flashcards_decks.flashcarddeck_id) {
      todayFlashcardLibraryIds.push(s.flashcards_decks.flashcarddeck_id);
    }
  });



  let flashcardsStatsToday = { studied: 0, correct: 0 };
  try {


    if (todayFlashcardLibraryIds.length > 0) {
      const libraryPlaceholders = todayFlashcardLibraryIds
        .map(() => "?")
        .join(",");

      const [flashcardStudied] = await client.execute(
        `SELECT COUNT(DISTINCT cp.flashcard_id) as studied
         FROM student_flashcard_card_progress cp
         INNER JOIN flashcards f ON cp.flashcard_id = f.flashcard_id
         WHERE cp.student_id = ? 
           AND DATE(cp.last_seen) = ?
           AND f.library_id IN (${libraryPlaceholders})`,
        [studentId, today, ...todayFlashcardLibraryIds]
      );
      console.log(
        `[getTodayOverview] Flashcards studied (with library filter):`,
        flashcardStudied[0]
      );
      flashcardsStatsToday.studied = Number(flashcardStudied[0]?.studied) || 0;



      const [flashcardCorrect] = await client.execute(
        `SELECT COUNT(*) as correct
         FROM student_activity_log sal
         WHERE sal.student_id = ?
           AND sal.activity_type = 'flashcard_studied'
           AND DATE(sal.created_at) = ?
           AND (
             JSON_EXTRACT(sal.metadata, '$.is_correct') = true
             OR JSON_EXTRACT(sal.metadata, '$.is_correct') = 'true'
             OR JSON_EXTRACT(sal.metadata, '$.is_correct') = 1
           )
           AND JSON_EXTRACT(sal.metadata, '$.flashcard_id') IN (
             SELECT f.flashcard_id 
             FROM flashcards f 
             WHERE f.library_id IN (${libraryPlaceholders})
           )`,
        [studentId, today, ...todayFlashcardLibraryIds]
      );
      flashcardsStatsToday.correct = Number(flashcardCorrect[0]?.correct) || 0;



      if (
        flashcardsStatsToday.correct === 0 &&
        flashcardsStatsToday.studied > 0
      ) {
        const [flashcardProgress] = await client.execute(
          `SELECT COUNT(DISTINCT cp.flashcard_id) as correct_count
           FROM student_flashcard_card_progress cp
           INNER JOIN flashcards f ON cp.flashcard_id = f.flashcard_id
           WHERE cp.student_id = ? 
             AND DATE(cp.last_seen) = ?
             AND cp.correct > 0
             AND f.library_id IN (${libraryPlaceholders})`,
          [studentId, today, ...todayFlashcardLibraryIds]
        );
        flashcardsStatsToday.correct =
          Number(flashcardProgress[0]?.correct_count) || 0;
      }
    } else {


      const [flashcardStudied] = await client.execute(
        `SELECT COUNT(DISTINCT cp.flashcard_id) as studied
         FROM student_flashcard_card_progress cp
         WHERE cp.student_id = ? 
           AND DATE(cp.last_seen) = ?`,
        [studentId, today]
      );
      console.log(
        `[getTodayOverview] Flashcards studied (all today):`,
        flashcardStudied[0]
      );
      flashcardsStatsToday.studied = Number(flashcardStudied[0]?.studied) || 0;
    }


    if (flashcardsStatsToday.studied === 0) {
      flashcardsStatsToday.studied = sessionsToday.reduce(
        (sum, s) => sum + (Number(s.flashcards_studied) || 0),
        0
      );
    }
  } catch (err) {
    console.error("Failed to get flashcards stats:", err);

    flashcardsStatsToday.studied = sessionsToday.reduce(
      (sum, s) => sum + (Number(s.flashcards_studied) || 0),
      0
    );
  }

  const tasks = sessionsToday.map((s, idx) => {

    const qbanks = Array.isArray(s.qbank)
      ? s.qbank
      : s.qbank?.qbank_id
        ? [s.qbank]
        : [];
    const hasQbank = qbanks.length > 0 && qbanks.some((q) => q?.qbank_id);
    const hasFlashcards = !!(
      s.flashcards_decks && s.flashcards_decks.flashcarddeck_id
    );
    const hasExam = !!(s.exams && s.exams.exam_id);

    const isQuestions = hasQbank;
    const isFlashcards = hasFlashcards;

    const title = isQuestions
      ? "Practice Questions"
      : isFlashcards
        ? "Study Flashcards"
        : "Study Content";

    const qbank = qbanks;
    const exams = s.exams || {};
    const flashcardsDeck = s.flashcards_decks || {};
    const ebooks = s.ebooks || {};
    const subtitle =
      qbank.qbank_name ||
      flashcardsDeck.flashcarddeck_name ||
      exams.exam_name ||
      ebooks.ebook_name ||
      "General";

    const started = isQuestions
      ? Number(qbank.started) || 0
      : isFlashcards
        ? Number(flashcardsDeck.started) || 0
        : hasExam
          ? Number(exams.started) || 0
          : Number(ebooks.started) || 0;


    const status = started > 0 ? "in_progress" : "pending";
    if (status === "completed") completedCount += 1;

    const timeSpent = Number(s.time_spent) || 0;
    studyTimeMinutes += Math.round(timeSpent / 60);

    let progress = 0;
    if (isQuestions && qbank.qbank_id) {

      progress = Number(qbank.progress) || 0;

      progress = Math.min(100, progress);
    } else if (isFlashcards) {

      const flashcardsStudied = Number(s.flashcards_studied) || 0;
      progress = Math.min(
        100,
        Math.round((flashcardsStudied / flashcardsGoalPerSession) * 100)
      );
    } else {

      progress = Math.min(
        100,
        Math.round((timeSpent / 60 / minutesPerSession) * 100)
      );
    }

    return {
      id: s.session_id,
      title,
      subtitle,
      type: s.type,
      duration: `${minutesPerSession}m`,
      status,
      priority: idx % 3 === 0 ? "high" : idx % 3 === 1 ? "medium" : "low",
      progress,
      dueTime: null,
      description: null,
      notes: null
    };
  });

  const questionsGoalToday =
    sessionsToday.filter((s) => {
      const qbanks = Array.isArray(s.qbank)
        ? s.qbank
        : s.qbank?.qbank_id
          ? [s.qbank]
          : [];
      return qbanks.length > 0 && qbanks.some((q) => q?.qbank_id);
    }).length * questionsGoalPerSession;
  const flashcardsGoalToday =
    sessionsToday.filter(
      (s) => s.flashcards_decks && s.flashcards_decks.flashcarddeck_id
    ).length * flashcardsGoalPerSession;


  totalAttempted = questionsStatsToday.attempted;
  totalCorrect = questionsStatsToday.correct;
  totalStudied = flashcardsStatsToday.studied;
  totalFlashCorrect = flashcardsStatsToday.correct;


  const questionAccuracyPercent =
    totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;


  const flashcardAccuracyPercent =
    totalStudied > 0 ? Math.round((totalFlashCorrect / totalStudied) * 100) : 0;

  const completionPercentage = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  const [recentRows] = await client.execute(
    `SELECT 
       s.session_id,
       s.*,
       s.study_day_date AS session_date,
       CASE 
         WHEN s.qbank_id IS NOT NULL THEN 'question_bank'
         WHEN s.flashcarddeck_id IS NOT NULL THEN 'flashcards'
         WHEN s.exam_id IS NOT NULL THEN 'exams'
         ELSE 'content'
       END AS session_type,
       -- Get started status (same as getPlanSessions)
       COALESCE(
         (SELECT id FROM new_student_plan_content 
          WHERE session_id = s.session_id 
          AND (
            (content_type = 'qbank' AND content_id = s.qbank_id) OR
            (content_type = 'flashcard' AND content_id = s.flashcarddeck_id) OR
            (content_type = 'exam' AND content_id = s.exam_id) OR
            (content_type = 'ebook' AND content_id = s.ebook_id)
          )
          LIMIT 1),
         0
       ) AS started,
       -- Get questions_attempted from solved_questions table
       -- Count all solved questions for this qbank (total progress)
       CASE 
         WHEN s.qbank_id IS NOT NULL THEN
           COALESCE(
             (SELECT COUNT(*) 
              FROM solved_questions sq
              WHERE sq.qbank_id = s.qbank_id 
                AND sq.student_id = ?
                AND sq.qbank_id IS NOT NULL
             ),
             0
           )
         ELSE 0
       END AS questions_attempted,
       -- Get flashcards_studied from student_flashcard_card_progress table
       -- Only count if session has a flashcarddeck_id
       CASE 
         WHEN s.flashcarddeck_id IS NOT NULL THEN
           COALESCE(
             (SELECT COUNT(DISTINCT cp.flashcard_id)
              FROM student_flashcard_card_progress cp
              INNER JOIN flashcards f ON cp.flashcard_id = f.flashcard_id
              WHERE f.library_id = s.flashcarddeck_id
                AND cp.student_id = ?
             ),
             0
           )
         ELSE 0
       END AS flashcards_studied,
       -- Time spent: can be calculated from activity log or set to 0 for now
       0 AS time_spent
     FROM new_student_plan_sessions s
     WHERE  DATE(s.study_day_date) <= CURDATE()
     ORDER BY s.study_day_date DESC, s.session_id DESC
     LIMIT 5`,
    [studentId, studentId]
  );


  const [recentTasks] = await client.execute(
    `SELECT 
       s.session_id,
       s.*,
       s.study_day_date AS session_date,
       CASE 
         WHEN s.qbank_id IS NOT NULL THEN 'question_bank'
         WHEN s.flashcarddeck_id IS NOT NULL THEN 'flashcards'
         WHEN s.exam_id IS NOT NULL THEN 'exams'
         ELSE 'content'
       END AS session_type,
       -- Get started status (same as getPlanSessions)
       COALESCE(
         (SELECT id FROM new_student_plan_content 
          WHERE session_id = s.session_id 
          AND (
            (content_type = 'qbank' AND content_id = s.qbank_id) OR
            (content_type = 'flashcard' AND content_id = s.flashcarddeck_id) OR
            (content_type = 'exam' AND content_id = s.exam_id) OR
            (content_type = 'ebook' AND content_id = s.ebook_id)
          )
          LIMIT 1),
         0
       ) AS started,
       -- Get questions_attempted from solved_questions table
       -- Count all solved questions for this qbank (total progress)
       CASE 
         WHEN s.qbank_id IS NOT NULL THEN
           COALESCE(
             (SELECT COUNT(*) 
              FROM solved_questions sq
              WHERE sq.qbank_id = s.qbank_id 
                AND sq.student_id = ?
                AND sq.qbank_id IS NOT NULL
             ),
             0
           )
         ELSE 0
       END AS questions_attempted,
       -- Get flashcards_studied from student_flashcard_card_progress table
       -- Only count if session has a flashcarddeck_id
       CASE 
         WHEN s.flashcarddeck_id IS NOT NULL THEN
           COALESCE(
             (SELECT COUNT(DISTINCT cp.flashcard_id)
              FROM student_flashcard_card_progress cp
              INNER JOIN flashcards f ON cp.flashcard_id = f.flashcard_id
              WHERE f.library_id = s.flashcarddeck_id
                AND cp.student_id = ?
             ),
             0
           )
         ELSE 0
       END AS flashcards_studied,
       -- Time spent: can be calculated from activity log or set to 0 for now
       0 AS time_spent
     FROM new_student_plan_sessions s
     WHERE  DATE(s.study_day_date) = CURDATE()
     ORDER BY s.study_day_date DESC, s.session_id DESC
     LIMIT 5`,
    [studentId, studentId]
  );
  const recent_sessions = recentRows.map((r) => r.exam_id || r.flashcarddeck_id || r.ebook_id || r.qbank_id ? ({
    id: r.session_id,
    date: r.session_date,
    type: r.exam_id ? "exam" : r.flashcarddeck_id ? "flashcard" : r.ebook_id ? "ebook" : r.qbank_id ? "question_bank" : "content",
    exam_id: r.exam_id,
    index_id: r.index_id,
    flashcarddeck_id: r.flashcarddeck_id,
    ebook_id: r.ebook_id,
    study_day_date: r.study_day_date,
    qbank_id: r.qbank_id,
    status: (Number(r.started) || 0) > 0 ? "in_progress" : "pending",
    questions_attempted: Number(r.questions_attempted) || 0,
    flashcards_studied: Number(r.flashcards_studied) || 0,
    time_spent_minutes: Math.round((Number(r.time_spent) || 0) / 60)
  }) : null).filter(Boolean);


  const recent_tasks = recentRows.map((r) => r.exam_id || r.flashcarddeck_id || r.ebook_id || r.qbank_id ? ({
    id: r.session_id,
    date: r.session_date,
    type: r.exam_id ? "exam" : r.flashcarddeck_id ? "flashcard" : r.ebook_id ? "ebook" : r.qbank_id ? "question_bank" : "content",
    exam_id: r.exam_id,
    index_id: r.index_id,
    flashcarddeck_id: r.flashcarddeck_id,
    ebook_id: r.ebook_id,
    study_day_date: r.study_day_date,
    qbank_id: r.qbank_id,
    status: (Number(r.started) || 0) > 0 ? "in_progress" : "pending",
    questions_attempted: Number(r.questions_attempted) || 0,
    flashcards_studied: Number(r.flashcards_studied) || 0,
    time_spent_minutes: Math.round((Number(r.time_spent) || 0) / 60)
  }) : null).filter(Boolean);

  return {
    streak,
    plan: { id: plan.plan_id, name: plan.plan_name },
    tasks: recent_tasks,
    stats: {
      study_time_minutes: studyTimeMinutes,
      questions_today: {
        attempted: totalAttempted,
        correct: totalCorrect,
        goal: questionsGoalToday
      },
      flashcards_today: {
        studied: totalStudied,
        goal: flashcardsGoalToday,
        accuracy_percent: flashcardAccuracyPercent
      },
      completion_percentage: completionPercentage
    },
    recent_sessions
  };
}

async function updateSessionProgress({
  sessionId,
  studentId,
  questionsAttempted,
  questionsCorrect,
  flashcardsStudied,
  timeSpent,
  status
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

async function getDetailedContentInfo(content) {
  const detailedContent = { ...content };

  const allModuleIds = [
    ...(content.exams_modules || []),
    ...(content.flashcards_modules || []),
    ...(content.question_bank_modules || [])
  ];

  const allTopicIds = [
    ...(content.exams_topics || []),
    ...(content.flashcards_topics || []),
    ...(content.question_bank_topics || [])
  ];

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
        color: module.subject_color
      };
    });

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

    const [unitsRows] = await client.execute(
      `SELECT unit_id, unit_name, module_id, status, unit_order
       FROM units 
       WHERE module_id IN (${allModuleIds.map(() => "?").join(",")})
         AND status = 'active'
       ORDER BY unit_order ASC, created_at ASC`,
      allModuleIds
    );

    const subjectsByModule = {};
    unitsRows.forEach((unit) => {
      if (!subjectsByModule[unit.module_id])
        subjectsByModule[unit.module_id] = [];
      subjectsByModule[unit.module_id].push({
        id: unit.unit_id,
        name: unit.unit_name,
        module_id: unit.module_id
      });
    });

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
      module_id: u.module_id
    }));
  }

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
          name: topic.unit_name
        },
        module: {
          id: topic.module_id,
          name: topic.module_name,
          code: topic.module_code
        }
      };
    });

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

async function getPlanSummary({ planId, studentId }) {
  const plan = await getStudyPlanById({ planId, studentId });
  if (!plan) return null;

  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);
  const studyDays = plan.study_days;

  const totalDays =
    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

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

  const hours = Math.floor(plan.daily_time_budget / 60);
  const minutes = plan.daily_time_budget % 60;
  const dailyBudget = `${hours}h ${minutes}m`;

  return {
    date_range: {
      start: plan.start_date,
      end: plan.end_date
    },
    total_days: totalDays,
    study_days: studyDaysCount,
    total_items: totalItems,
    daily_budget: dailyBudget,
    plan_name: plan.plan_name,
    status: plan.status
  };
}

async function getModulesWithStats({ studentId = null } = {}) {
  let sql = `
    SELECT m.module_id, m.subject_name as module_name, m.subject_code, m.description as module_description,
           m.subject_color
    FROM modules m
    WHERE m.status = 'active'
  `;

  let params = [];

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

  const modulesWithStats = await Promise.all(
    modules.map(async (module) => {
      const [unitsResult] = await client.execute(
        `SELECT COUNT(*) as count FROM units WHERE module_id = ? AND status = 'active'`,
        [module.module_id]
      );

      const [topicsResult] = await client.execute(
        `SELECT COUNT(*) as count FROM topics t 
       INNER JOIN units u ON u.unit_id = t.unit_id 
       WHERE u.module_id = ? AND t.status = 'active' AND u.status = 'active'`,
        [module.module_id]
      );

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
        questions_count: questionsResult[0].count
      };
    })
  );

  return modulesWithStats;
}

async function getTopicsByModule({ moduleId }) {
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

  let unitIds = moduleId;
  if (typeof unitIds === "string")
    unitIds = unitIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  else if (!Array.isArray(unitIds)) unitIds = [unitIds];

  if (!unitIds?.length) return [];



  const unitTmp = `tmp_units_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  await client.execute(
    `CREATE TEMPORARY TABLE ${unitTmp} (unit_id INT PRIMARY KEY) ENGINE=MEMORY`
  );
  const insertBatch = unitIds.map((id) => `(${client.escape(id)})`);
  await client.execute(
    `INSERT INTO ${unitTmp} VALUES ${insertBatch.join(",")}`
  );


  const latestTmp = studentId ? `tmp_latest_${Date.now()}` : null;
  if (studentId) {
    await client.execute(
      `
      CREATE TEMPORARY TABLE ${latestTmp} (
        question_id INT PRIMARY KEY,
        is_correct  CHAR(1)
      ) ENGINE=MEMORY
      AS
      SELECT s1.question_id, s1.is_correct
      FROM solved_questions s1
      INNER JOIN (
        SELECT question_id, MAX(created_at) AS max_created
        FROM solved_questions
        WHERE student_id = ?
        GROUP BY question_id
      ) s2
        ON s2.question_id = s1.question_id
       AND s2.max_created = s1.created_at
      WHERE s1.student_id = ?
    `,
      [studentId, studentId]
    );
  }


  const sql = `
    SELECT 
      t.topic_id, 
      t.topic_name, 
      t.short_description,
      u.unit_id, 
      u.unit_name,

      COALESCE(q_cnt.questions,0)                AS questions_count,
      COALESCE(f_cnt.flashcards,0)               AS flashcards_count,

      COALESCE(q_easy.cnt,0)                     AS easy_count,
      COALESCE(q_medium.cnt,0)                   AS medium_count,
      COALESCE(q_hard.cnt,0)                     AS difficult_count,

      ${studentId
      ? `
      COALESCE(sq_cnt.attempted,0)               AS attempted_count,
      COALESCE(sq_correct.cnt,0)                 AS correct_count,
      COALESCE(sq_wrong.cnt,0)                   AS wrong_count,
      COALESCE(q_cnt.questions,0) - COALESCE(sq_cnt.attempted,0) AS unsolved_count,
      COALESCE(mcq_cnt.marked,0)                 AS marked_count,

      COALESCE(sq_easy_correct.cnt,0)            AS correct_count_easy,
      COALESCE(sq_medium_correct.cnt,0)          AS correct_count_medium,
      COALESCE(sq_hard_correct.cnt,0)            AS correct_count_hard,

      COALESCE(sq_easy_wrong.cnt,0)              AS wrong_count_easy,
      COALESCE(sq_medium_wrong.cnt,0)            AS wrong_count_medium,
      COALESCE(sq_hard_wrong.cnt,0)              AS wrong_count_hard,

      COALESCE(q_easy.cnt,0) - COALESCE(sq_easy_correct.cnt,0) - COALESCE(sq_easy_wrong.cnt,0) AS unused_count_easy,
      COALESCE(q_medium.cnt,0) - COALESCE(sq_medium_correct.cnt,0) - COALESCE(sq_medium_wrong.cnt,0) AS unused_count_medium,
      COALESCE(q_hard.cnt,0) - COALESCE(sq_hard_correct.cnt,0) - COALESCE(sq_hard_wrong.cnt,0) AS unused_count_hard,

      COALESCE(mcq_easy.cnt,0)                   AS marked_count_easy,
      COALESCE(mcq_medium.cnt,0)                 AS marked_count_medium,
      COALESCE(mcq_hard.cnt,0)                   AS marked_count_hard
      `
      : `
      0 AS attempted_count, 0 AS correct_count, 0 AS wrong_count,
      COALESCE(q_cnt.questions,0) AS unsolved_count,
        0 AS marked_count,
      0 AS correct_count_easy, 0 AS correct_count_medium, 0 AS correct_count_hard,
      0 AS wrong_count_easy,   0 AS wrong_count_medium,   0 AS wrong_count_hard,
      COALESCE(q_easy.cnt,0)   AS unused_count_easy,
      COALESCE(q_medium.cnt,0) AS unused_count_medium,
      COALESCE(q_hard.cnt,0)   AS unused_count_hard,
      0 AS marked_count_easy,  0 AS marked_count_medium,  0 AS marked_count_hard
      `
    }
    FROM topics t
    INNER JOIN units u       ON u.unit_id = t.unit_id AND u.status = 'active'
    INNER JOIN ${unitTmp} tu ON tu.unit_id = u.unit_id
    /* ---- pre-aggregated counts (all use indexes) ---- */
    LEFT JOIN (SELECT topic_id, COUNT(*) AS questions FROM questions GROUP BY topic_id) q_cnt
           ON q_cnt.topic_id = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS flashcards FROM flashcards GROUP BY topic_id) f_cnt
           ON f_cnt.topic_id = t.topic_id

    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions WHERE difficulty_level='easy'   GROUP BY topic_id) q_easy   ON q_easy.topic_id   = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions WHERE difficulty_level='medium' GROUP BY topic_id) q_medium ON q_medium.topic_id = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions WHERE difficulty_level='hard'   GROUP BY topic_id) q_hard   ON q_hard.topic_id   = t.topic_id

    ${studentId
      ? `
    LEFT JOIN ${latestTmp} sq ON sq.question_id IN (SELECT question_id FROM questions WHERE topic_id = t.topic_id)
    LEFT JOIN (SELECT topic_id, COUNT(*) AS attempted FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id
               GROUP BY topic_id) sq_cnt ON sq_cnt.topic_id = t.topic_id

    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='1'
               GROUP BY topic_id) sq_correct ON sq_correct.topic_id = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='0'
               GROUP BY topic_id) sq_wrong   ON sq_wrong.topic_id   = t.topic_id

    /* per-difficulty correct */
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='1' AND q.difficulty_level='easy'
               GROUP BY topic_id) sq_easy_correct   ON sq_easy_correct.topic_id   = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='1' AND q.difficulty_level='medium'
               GROUP BY topic_id) sq_medium_correct ON sq_medium_correct.topic_id = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='1' AND q.difficulty_level='hard'
               GROUP BY topic_id) sq_hard_correct   ON sq_hard_correct.topic_id   = t.topic_id

    /* per-difficulty wrong */
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='0' AND q.difficulty_level='easy'
               GROUP BY topic_id) sq_easy_wrong   ON sq_easy_wrong.topic_id   = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='0' AND q.difficulty_level='medium'
               GROUP BY topic_id) sq_medium_wrong ON sq_medium_wrong.topic_id = t.topic_id
    LEFT JOIN (SELECT topic_id, COUNT(*) AS cnt FROM questions q
               INNER JOIN ${latestTmp} s ON s.question_id = q.question_id AND s.is_correct='0' AND q.difficulty_level='hard'
               GROUP BY topic_id) sq_hard_wrong   ON sq_hard_wrong.topic_id   = t.topic_id

    /* marked */
    LEFT JOIN (SELECT q.topic_id, COUNT(*) AS marked
               FROM mark_category_question mcq
               INNER JOIN questions q ON q.question_id = mcq.question_id
               INNER JOIN student_mark_categories smc
                 ON smc.student_mark_category_id = mcq.category_id
                AND smc.student_id = ?
               GROUP BY q.topic_id) mcq_cnt ON mcq_cnt.topic_id = t.topic_id

    LEFT JOIN (SELECT q.topic_id, COUNT(*) AS cnt
               FROM mark_category_question mcq
               INNER JOIN questions q ON q.question_id = mcq.question_id
               INNER JOIN student_mark_categories smc
                 ON smc.student_mark_category_id = mcq.category_id
                AND smc.student_id = ?
               WHERE q.difficulty_level='easy' GROUP BY q.topic_id) mcq_easy   ON mcq_easy.topic_id   = t.topic_id
    LEFT JOIN (SELECT q.topic_id, COUNT(*) AS cnt
               FROM mark_category_question mcq
               INNER JOIN questions q ON q.question_id = mcq.question_id
               INNER JOIN student_mark_categories smc
                 ON smc.student_mark_category_id = mcq.category_id
                AND smc.student_id = ?
               WHERE q.difficulty_level='medium' GROUP BY q.topic_id) mcq_medium ON mcq_medium.topic_id = t.topic_id
    LEFT JOIN (SELECT q.topic_id, COUNT(*) AS cnt
               FROM mark_category_question mcq
               INNER JOIN questions q ON q.question_id = mcq.question_id
               INNER JOIN student_mark_categories smc
                 ON smc.student_mark_category_id = mcq.category_id
                AND smc.student_id = ?
               WHERE q.difficulty_level='hard' GROUP BY q.topic_id) mcq_hard   ON mcq_hard.topic_id   = t.topic_id
    `
      : ""
    }

    WHERE t.status = 'active'
    GROUP BY t.topic_id, t.topic_name, t.short_description, u.unit_id, u.unit_name
    ORDER BY t.topic_id ASC;
  `;

  const params = studentId ? [studentId, studentId, studentId, studentId] : [];

  const [rows] = await client.execute(sql, params);


  client.execute(`DROP TEMPORARY TABLE IF EXISTS ${unitTmp}`).catch(() => { });
  if (latestTmp)
    client
      .execute(`DROP TEMPORARY TABLE IF EXISTS ${latestTmp}`)
      .catch(() => { });

  return rows.map((r) => ({ ...r, questions: [] }));
}

async function getSubjectsByModule({ moduleId }) {
  let unitIds = moduleId;
  if (typeof unitIds === "string") {
    unitIds = unitIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
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

  const categoriesMap = {};

  rows.forEach((row) => {
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

async function getDashboardOverview({ studentId }) {
  const today = new Date().toISOString().split("T")[0];
  const [plans] = await client.execute(
    `SELECT * FROM student_study_plans 
     WHERE student_id = ? AND status = 'active' 
     ORDER BY updated_at DESC LIMIT 1`,
    [studentId]
  );

  const activePlan = plans.length > 0 ? plans[0] : null;

  const [questionsStats] = await client.execute(
    `SELECT 
       COUNT(*) as total_answered,
       SUM(CASE WHEN is_correct = '1' THEN 1 ELSE 0 END) as total_correct
     FROM solved_questions
     WHERE student_id = ?`,
    [studentId]
  );

  const [studyTimeStats] = await client.execute(
    `SELECT 
       SUM(time_spent) as total_time_spent
     FROM student_plan_sessions
     WHERE plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)`,
    [studentId]
  );

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

  const currentPlanProgress = activePlan
    ? {
      completed: 0,
      total: 0
    }
    : { completed: 0, total: 0 };

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
      currentPlanProgress.completed =
        Number(sessionStats[0].completed_sessions) || 0;
      currentPlanProgress.total = Number(sessionStats[0].total_sessions) || 0;
    }
  }

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

  const allActivities = [
    ...recentQuestions,
    ...recentFlashcards,
    ...recentExams,
    ...recentSessions
  ]
    .sort((a, b) => new Date(b.activity_time) - new Date(a.activity_time))
    .slice(0, 5)
    .map((a) => ({
      title: a.title || "",
      details: a.details || "",
      time: a.time || "",
      points: a.points || ""
    }));

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

  const nextExamDate =
    examInfo.length > 0 && examInfo[0].next_exam_date
      ? new Date(examInfo[0].next_exam_date)
      : null;

  const daysUntilExam = nextExamDate
    ? Math.max(
      0,
      Math.ceil((nextExamDate - new Date()) / (1000 * 60 * 60 * 24))
    )
    : 30;

  const questionsAnswered = Number(questionsStats[0]?.total_answered) || 0;
  const questionsCorrect = Number(questionsStats[0]?.total_correct) || 0;
  const accuracy =
    questionsAnswered > 0
      ? Math.round((questionsCorrect / questionsAnswered) * 100)
      : 0;

  const totalMinutesStudied = Math.round(
    (Number(studyTimeStats[0]?.total_time_spent) || 0) / 60
  );
  const hoursStudied = Math.round((totalMinutesStudied / 60) * 10) / 10;

  return {
    currentPlan: currentPlanProgress,
    healthcareMastered: {
      completed: Number(healthcareStats[0]?.mastered_topics) || 0,
      total: Number(healthcareStats[0]?.total_topics) || 0
    },
    studyBreak: null,
    recentActivity: allActivities,
    upcomingDeadlines: upcomingDeadlines.map((d) => ({
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
  getMarkedCategoriesAndQuestions,
  startSessionContent
};
