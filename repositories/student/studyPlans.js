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
  return {
    ...plan,
    study_days: JSON.parse(plan.study_days),
    daily_limits: plan.daily_limits ? JSON.parse(plan.daily_limits) : null,
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
}) {
  const sql = `INSERT INTO student_plan_content 
               (plan_id, exams_modules, exams_topics, flashcards_modules, flashcards_topics, 
                question_bank_modules, question_bank_topics, question_bank_quizzes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    planId,
    examsModules ? JSON.stringify(examsModules) : null,
    examsTopics ? JSON.stringify(examsTopics) : null,
    flashcardsModules ? JSON.stringify(flashcardsModules) : null,
    flashcardsTopics ? JSON.stringify(flashcardsTopics) : null,
    questionBankModules ? JSON.stringify(questionBankModules) : null,
    questionBankTopics ? JSON.stringify(questionBankTopics) : null,
    questionBankQuizzes ? JSON.stringify(questionBankQuizzes) : null,
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

  // Generate sessions for each study day between start and end date
  const sessions = [];
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
    });
  }

  if (contentItems.length === 0) {
    throw new Error("No content added to plan");
  }

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc. (JavaScript default)

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

    if (studyDaysNumbers.includes(dayOfWeek)) {
      // Create sessions for each content type
      for (const contentItem of contentItems) {
        sessions.push({
          plan_id: planId,
          session_date: date.toISOString().split("T")[0],
          session_type: contentItem.content_type,
          content_id: contentItem.content_id,
        });
      }
    }
  }

  // Insert sessions in batch
  if (sessions.length > 0) {
    console.log(`Generating ${sessions.length} sessions for plan ${planId}`);

    const sql = `INSERT INTO student_plan_sessions 
                 (plan_id, session_date, session_type, content_id)
                 VALUES (?, ?, ?, ?)`;

    // Prepare all values for batch insert
    const values = sessions.map((session) => [
      session.plan_id,
      session.session_date,
      session.session_type,
      session.content_id,
    ]);

    // Execute all inserts in parallel
    const startTime = Date.now();
    await Promise.all(values.map((valueSet) => client.execute(sql, valueSet)));
    const endTime = Date.now();

    console.log(`Sessions created in ${endTime - startTime}ms`);
  }

  return { sessions_created: sessions.length };
}

async function getPlanSessions({
  planId,
  studentId,
  date = null,
  status = null,
}) {
  let sql = `SELECT s.*, c.exams_modules, c.exams_topics, c.flashcards_modules, 
             c.flashcards_topics, c.question_bank_modules, c.question_bank_topics, 
             c.question_bank_quizzes
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



async function getTopicsBySubject({ moduleId }) {
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
    SELECT t.topic_id, t.topic_name, t.short_description,
           u.unit_id, u.unit_name,
           COUNT(DISTINCT q.question_id) as questions_count,
           COUNT(DISTINCT f.flashcard_id) as flashcards_count
    FROM topics t
    LEFT JOIN units u ON u.unit_id = t.unit_id
    LEFT JOIN questions q ON q.topic_id = t.topic_id
    LEFT JOIN flashcards f ON f.topic_id = t.topic_id
    WHERE u.unit_id IN (${placeholders}) AND t.status = 'active' AND u.status = 'active'
    GROUP BY t.topic_id, t.topic_name, t.short_description, u.unit_id, u.unit_name
    ORDER BY u.unit_order, t.topic_order, t.topic_name
  `,
    unitIds
  );
  return rows;
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
  getSubjectsByModule
};
