const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/studyPlans");
const getTokenFromHeader = require("../../utils/getToken");
const { verifyAccessToken } = require("../../utils/jwt");

function getStudentId(req, res) {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return null;
    const decoded = verifyAccessToken(token, "student");
    return decoded?.id || decoded?.student_id || decoded?.user?.student_id;
  } catch (err) {
    console.error("Token verification error:", err.message);
    return null;
  }
}

// Step 1: Schedule Setup
async function createPlan(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }


  /*
  {
  "plan_name": "خطة التحضير لامتحان USMLE4",
  "start_date": "2025-10-28",
  "end_date": "2025-11-02",
  "study_days": ["Sat", "Sun", "Mon", "Tue"],
  "daily_time_budget": 180,
  "daily_limits": {
    "max_questions": 50,
    "max_flashcards": 60
  },
  "question_mode": "study",
  "difficulty_balance": "balanced",
  "questions_per_session": 20,
  "exams": [17],
  "flashcards_modules": [25],
  "flashcards_decks": [22, 23],
  "question_bank_modules": 23,
  "question_bank_subject": [18, 19],
  "question_bank_topics": [110, 105],
  "books_module": 23,
  "books": 1
}
  */

  const {
    plan_name,
    start_date,
    end_date,
    study_days,
    daily_time_budget,
    daily_limits,
    question_mode,
    difficulty_balance,
    questions_per_session,
    exams,
    flashcards_modules,
    flashcards_decks,
    question_bank_modules,
    question_bank_subject,
    question_bank_topics,
    books_module,
    books,
    book_indeces,
  } = req.body || {};

  // Normalize helpers
  const toArray = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

  try {
    // Create the plan
    const created = await repo.createStudyPlan({
      studentId,
      planName: plan_name,
      startDate: start_date,
      endDate: end_date,
      studyDays: study_days,
      dailyTimeBudget: daily_time_budget,
      dailyLimits: daily_limits || null,
      questionMode: question_mode || "study",
      difficultyBalance: difficulty_balance || "balanced",
      questionsPerSession: questions_per_session || 20,
      questionBankModules: toArray(question_bank_modules),
      questionBankTopics: question_bank_topics || [],
      questionBankSubject: question_bank_subject || [],
      booksModule: books_module || [],
      booksIndeces: book_indeces || [],
      books: books || [],
      flashcardsDecks: flashcards_decks || [],
      flashcardsModules: flashcards_modules || [],
      exams: exams || [],

    });

    // Add content to the plan
    await repo.addPlanContent({
      planId: created.plan_id,
      examsModules: toArray(exams),
      examsTopics: req.body?.exams_topics || [],
      flashcardsModules: flashcards_modules || [],
      flashcardsTopics: req.body?.flashcards_topics || [],
      questionBankModules: toArray(question_bank_modules),
      questionBankTopics: question_bank_topics || [],
      questionBankQuizzes: req.body?.question_bank_quizzes || [],
      subjects: req.body?.subjects || question_bank_subject || [],
    });

    return responseBuilder.success(res, {
      data: created,
      message: "Complete study plan created successfully",
    });
  } catch (error) {
    console.error("Create plan error:", error);
    return responseBuilder.serverError(res, "Failed to create study plan");
  }
}

// Get all plans for student
async function getPlans(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { status } = req.query;
  const plans = await repo.getStudyPlans({ studentId, status });

  return responseBuilder.success(res, {
    data: plans,
    message: "Study plans retrieved successfully",
  });
}

// Get specific plan
async function getPlan(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;
  const plan = await repo.getStudyPlanById({
    planId: Number(plan_id),
    studentId,
  });

  if (!plan) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  return responseBuilder.success(res, {
    data: plan,
    message: "Study plan retrieved successfully",
  });
}

// Update plan
async function updatePlan(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;
  const {
    plan_name,
    start_date,
    end_date,
    study_days,
    daily_time_budget,
    daily_limits,
    question_mode,
    difficulty_balance,
    questions_per_session,
    status,
  } = req.body || {};

  try {
    const updated = await repo.updateStudyPlan({
      planId: Number(plan_id),
      studentId,
      planName: plan_name,
      startDate: start_date,
      endDate: end_date,
      studyDays: study_days,
      dailyTimeBudget: daily_time_budget,
      dailyLimits: daily_limits,
      questionMode: question_mode,
      difficultyBalance: difficulty_balance,
      questionsPerSession: questions_per_session,
      status: status,
    });

    if (!updated) {
      return responseBuilder.notFound(res, "Study plan not found");
    }

    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Study plan updated successfully",
    });
  } catch (error) {
    console.error("Update plan error:", error);
    return responseBuilder.serverError(res, "Failed to update study plan");
  }
}

// Delete plan
async function deletePlan(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;
  const deleted = await repo.deleteStudyPlan({
    planId: Number(plan_id),
    studentId,
  });

  if (!deleted) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  return responseBuilder.success(res, {
    data: { deleted: true },
    message: "Study plan deleted successfully",
  });
}
async function startSessionContent(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  // Get needed params from request
  const { planId, sessionId, contentType, contentId } = req.body;
  if (!planId || !sessionId || !contentType) {
    return responseBuilder.badRequest(res, "Missing required parameters");
  }
  try {
    const result = await repo.startSessionContent({
      planId,
      studentId,
      sessionId,
      contentType,
      contentId
    });
    return responseBuilder.success(res, {
      data: { id: result },
      message: "Session content started"
    });
  } catch (err) {
    console.error("startSessionContent error:", err);
    return responseBuilder.serverError(res, "Failed to start session content");
  }
}


// Step 3: Content Management - Add all content at once
async function addContent(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;
  const {
    exams_modules,
    exams_topics,
    flashcards_modules,
    flashcards_topics,
    question_bank_modules,
    question_bank_topics,
    question_bank_quizzes,
  } = req.body || {};

  // Validation - At least one content type must be provided
  if (!exams_modules && !flashcards_modules && !question_bank_modules) {
    return responseBuilder.badRequest(
      res,
      "At least one content type (exams, flashcards, or question_bank) must be provided"
    );
  }

  try {
    const created = await repo.addPlanContent({
      planId: Number(plan_id),
      examsModules: exams_modules || [],
      examsTopics: exams_topics || [],
      flashcardsModules: flashcards_modules || [],
      flashcardsTopics: flashcards_topics || [],
      questionBankModules: question_bank_modules || [],
      questionBankTopics: question_bank_topics || [],
      questionBankQuizzes: question_bank_quizzes || [],
    });

    const content = await repo.getPlanContent({ planId: Number(plan_id) });
    return responseBuilder.success(res, {
      data: content,
      message: "Plan content added successfully",
    });
  } catch (error) {
    console.error("Add content error:", error);
    return responseBuilder.serverError(res, "Failed to add content to plan");
  }
}

async function getContent(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;

  // Verify plan belongs to student
  const plan = await repo.getStudyPlanById({
    planId: Number(plan_id),
    studentId,
  });
  if (!plan) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  const content = await repo.getPlanContent({
    planId: Number(plan_id),
  });

  // Get plan summary information
  const summary = await repo.getPlanSummary({
    planId: Number(plan_id),
    studentId,
  });

  return responseBuilder.success(res, {
    data: {
      ...content,
      summary: summary,
    },
    message: "Plan content retrieved successfully",
  });
}

async function removeContent(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id, content_id } = req.params;

  // Verify plan belongs to student
  const plan = await repo.getStudyPlanById({
    planId: Number(plan_id),
    studentId,
  });
  if (!plan) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  const removed = await repo.removePlanContent({
    contentId: Number(content_id),
    planId: Number(plan_id),
  });

  if (!removed) {
    return responseBuilder.notFound(res, "Content not found");
  }

  return responseBuilder.success(res, {
    data: { removed: true },
    message: "Content removed from plan successfully",
  });
}

// Generate sessions
async function generateSessions(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;

  try {
    const result = await repo.generatePlanSessions({
      planId: Number(plan_id),
      studentId,
    });
console.log(result)
    return responseBuilder.success(res, {
      data: result,
      message: "Study sessions generated successfully",
    });
  } catch (error) {
    console.error("Generate sessions error:", error);
    return responseBuilder.badRequest(res, error.message);
  }
}

// Get sessions
async function getSessions(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id } = req.params;
  const { date, status, schedule } = req.query;

  // Verify plan belongs to student
  const plan = await repo.getStudyPlanById({
    planId: Number(plan_id),
    studentId,
  });
  if (!plan) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  // If schedule parameter is true, return detailed schedule
  if (schedule === "true") {
    const scheduleData = await repo.getSessionsWithSchedule({
      planId: Number(plan_id),
      studentId,
    });

    if (!scheduleData) {
      return responseBuilder.notFound(res, "Study plan not found");
    }

    return responseBuilder.success(res, {
      data: scheduleData,
      message: "Study schedule retrieved successfully",
    });
  }

  // Otherwise, return regular sessions
  const sessions = await repo.getPlanSessions({
    planId: Number(plan_id),
    studentId,
    date: date || null,
    status: status || null,
  });

  return responseBuilder.success(res, {
    data: sessions,
    message: "Study sessions retrieved successfully",
  });
}

// Update session progress
async function updateSessionProgress(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { session_id } = req.params;
  const {
    questions_attempted,
    questions_correct,
    flashcards_studied,
    time_spent,
    status,
  } = req.body || {};

  try {
    const updated = await repo.updateSessionProgress({
      sessionId: Number(session_id),
      studentId,
      questionsAttempted: questions_attempted,
      questionsCorrect: questions_correct,
      flashcardsStudied: flashcards_studied,
      timeSpent: time_spent,
      status: status,
    });

    if (!updated) {
      return responseBuilder.notFound(res, "Session not found");
    }

    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Session progress updated successfully",
    });
  } catch (error) {
    console.error("Update session error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to update session progress"
    );
  }
}

// Helper endpoints for content selection
async function getModules(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const modules = await repo.getModulesWithStats({ studentId });
    return responseBuilder.success(res, {
      data: modules,
      message: "Modules retrieved successfully",
    });
  } catch (error) {
    console.error("Get modules error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve modules");
  }
}

async function getTopicsByModule(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { module_id } = req.params;
  console.log(JSON.parse(module_id))
  try {
    const topics = await repo.getTopicsByModule({
      moduleId: JSON.parse(module_id)?.join(","),
    });
    return responseBuilder.success(res, {
      data: topics,
      message: "Topics retrieved successfully",
    });
  } catch (error) {
    console.error("Get topics error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve topics");
  }
}


async function getSubjectsByModule(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { module_id } = req.params;
  console.log(JSON.parse(module_id))
  try {
    const subjects = await repo.getSubjectsByModule({
      moduleId: JSON.parse(module_id)?.join(","),
    });
    return responseBuilder.success(res, {
      data: subjects,
      message: "Subjects retrieved successfully",
    });
  } catch (error) {
    console.error("Get subjects error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve subjects");
  }
}

// Get single session details
async function getSessionDetails(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  const { plan_id, session_id } = req.params;

  // Verify plan belongs to student
  const plan = await repo.getStudyPlanById({
    planId: Number(plan_id),
    studentId,
  });
  if (!plan) {
    return responseBuilder.notFound(res, "Study plan not found");
  }

  const details = await repo.getSessionDetails({
    planId: Number(plan_id),
    studentId,
    sessionId: Number(session_id),
  });

  if (!details) {
    return responseBuilder.notFound(res, "Session not found");
  }

  return responseBuilder.success(res, {
    data: details,
    message: "Session details retrieved successfully",
  });
}

async function getTopicsBySubject(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
console.log(studentId)
  const { module_id } = req.params;
  console.log(JSON.parse(module_id))
  try {
    const topics = await repo.getTopicsBySubject({
      moduleId: JSON.parse(module_id)?.join(","),
      studentId
    });
    return responseBuilder.success(res, {
      data: topics,
      message: "Topics retrieved successfully",
    });
  } catch (error) {
    console.error("Get topics error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve topics");
  }
}

// Today overview
async function getToday(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const overview = await repo.getTodayOverview({ studentId });
    return responseBuilder.success(res, {
      data: overview,
      message: "Today's overview retrieved successfully",
    });
  } catch (error) {
    console.error("getToday error:", error);
    return responseBuilder.serverError(res, "Failed to get today's overview");
  }
}

async function getDashboard(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const overview = await repo.getDashboardOverview({ studentId });
    console.log(overview)
    return responseBuilder.success(res, {
      data: overview,
      message: "Dashboard overview retrieved successfully",
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    return responseBuilder.serverError(res, "Failed to get dashboard overview");
  }
}

async function solveSessionQuestion(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { plan_id, session_id, question_id } = req.params;
  const { selected_option_id, answer_text } = req.body || {};

  try {
    const result = await repo.solveSessionQuestion({
      planId: Number(plan_id),
      sessionId: Number(session_id),
      studentId,
      questionId: Number(question_id),
      selectedOptionId: selected_option_id,
      answerText: answer_text,
    });

    if (!result.success) {
      return responseBuilder.badRequest(res, result.message || "Unable to solve question");
    }

    // Return updated session progress snapshot
    const details = await repo.getSessionDetails({
      planId: Number(plan_id),
      sessionId: Number(session_id),
      studentId,
    });

    return responseBuilder.success(res, {
      data: {
        result,
        progress: details?.progress,
      },
      message: "Question recorded and session progress updated",
    });
  } catch (error) {
    console.error("solveSessionQuestion error:", error);
    return responseBuilder.serverError(res, "Failed to solve question");
  }
}

async function reviewSessionFlashcard(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { plan_id, session_id, flashcard_id } = req.params;
  const { correct, status } = req.body || {};

  try {
    const result = await repo.reviewSessionFlashcard({
      planId: Number(plan_id),
      sessionId: Number(session_id),
      studentId,
      flashcardId: Number(flashcard_id),
      correct: !!correct,
      status: status || 'seen',
    });

    if (!result.success) {
      return responseBuilder.badRequest(res, result.message || "Unable to review flashcard");
    }

    // Return updated session progress snapshot
    const details = await repo.getSessionDetails({
      planId: Number(plan_id),
      sessionId: Number(session_id),
      studentId,
    });

    return responseBuilder.success(res, {
      data: {
        result,
        progress: details?.progress,
      },
      message: "Flashcard recorded and session progress updated",
    });
  } catch (error) {
    console.error("reviewSessionFlashcard error:", error);
    return responseBuilder.serverError(res, "Failed to review flashcard");
  }
}

module.exports = {
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
  addContent,
  getContent,
  removeContent,
  generateSessions,
  getSessions,
  updateSessionProgress,
  getModules,
  getTopicsByModule,
  getSubjectsByModule,
  getTopicsBySubject,
  getSessionDetails,
  solveSessionQuestion,
  reviewSessionFlashcard,
  getToday,
  getDashboard,
  startSessionContent,
  getStudentId
};
