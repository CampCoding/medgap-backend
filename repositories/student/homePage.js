const { client } = require("../../config/db-connect");
const activityTracking = require("./activityTracking");

// Check if we're using MySQL (development) or PostgreSQL (production)
const isMysql = true;

// Get daily quote (random from active quotes)
async function getDailyQuote() {
  const sql = `
    SELECT * FROM daily_quotes 
    WHERE is_active = 1 
    ORDER BY RAND() 
    LIMIT 1
  `;

  const [rows] = isMysql ? await client.execute(sql) : await client.query(sql);

  return (
    rows[0] || {
      quote_id: 1,
      quote_text:
        "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      author: "Winston Churchill",
      category: "motivation",
    }
  );
}

// Get student's current streak (automatic calculation)
async function getStudentStreak(studentId) {
  return await activityTracking.getStudentStreak(studentId);
}

// Get today's activity summary (automatic from logs)
async function getTodayActivity(studentId) {
  return await activityTracking.getTodayActivity(studentId);
}

// Get daily plan progress (automatic from study plans and sessions)
async function getDailyPlanProgress(studentId) {
  const today = new Date().toISOString().split("T")[0];

  const sql = `
    SELECT 
      sp.plan_name,
      sp.daily_time_budget,
      sp.questions_per_session,
      sp.daily_limits,
      COALESCE(SUM(sps.questions_attempted), 0) as questions_attempted,
      COALESCE(SUM(sps.questions_correct), 0) as questions_correct,
      COALESCE(SUM(sps.time_spent), 0) as time_spent,
      COALESCE(SUM(sps.flashcards_studied), 0) as flashcards_studied
    FROM student_study_plans sp
    LEFT JOIN student_plan_sessions sps ON sp.plan_id = sps.plan_id 
      AND sps.session_date = ? 
      AND sps.status IN ('completed', 'in_progress')
    WHERE sp.student_id = ? AND sp.status = 'active'
    GROUP BY sp.plan_id
    ORDER BY sp.updated_at DESC
    LIMIT 1
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [today, studentId])
    : await client.query(sql, [today, studentId]);

  if (rows.length === 0) {
    return {
      plan_name: "No active plan",
      daily_plan_progress: 0,
      daily_plan_questions: "0/0",
      study_time_progress: 0,
      study_time_minutes: "0/0",
      questions_progress: 0,
      questions_minutes: "0/0",
    };
  }

  const plan = rows[0];
  const dailyLimits = plan.daily_limits ? JSON.parse(plan.daily_limits) : {};
  const maxQuestions =
    dailyLimits.max_questions || plan.questions_per_session || 20;
  const maxFlashcards = dailyLimits.max_flashcards || 50;
  const maxTime = plan.daily_time_budget || 180;

  const dailyPlanProgress = Math.round(
    (plan.questions_attempted / maxQuestions) * 100
  );
  const studyTimeProgress = Math.round((plan.time_spent / maxTime) * 100);
  const questionsProgress = Math.round(
    (plan.questions_correct / maxQuestions) * 100
  );

  return {
    plan_name: plan.plan_name,
    daily_plan_progress: Math.min(dailyPlanProgress, 100),
    daily_plan_questions: `${plan.questions_attempted}/${maxQuestions}`,
    study_time_progress: Math.min(studyTimeProgress, 100),
    study_time_minutes: `${plan.time_spent}/${maxTime}`,
    questions_progress: Math.min(questionsProgress, 100),
    questions_minutes: `${plan.questions_correct}/${maxQuestions}`,
  };
}

// Get continue where you left off (recent plans)
async function getContinueWhereLeftOff(studentId) {
  const sql = `
    SELECT 
      sp.plan_id,
      sp.plan_name,
      sp.start_date,
      sp.end_date,
      sp.status,
      sp.updated_at,
      sp.difficulty_balance,
      COUNT(DISTINCT sps.session_id) as total_sessions,
      COALESCE(SUM(CASE WHEN sps.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_sessions,
      COALESCE(SUM(sps.questions_attempted), 0) as total_questions_attempted,
      COALESCE(SUM(sps.questions_correct), 0) as total_questions_correct,
      'Mixed Practice' as module_names
    FROM student_study_plans sp
    LEFT JOIN student_plan_sessions sps ON sp.plan_id = sps.plan_id
    WHERE sp.student_id = ? AND sp.status IN ('active', 'paused')
    GROUP BY sp.plan_id
    ORDER BY sp.updated_at DESC
    LIMIT 3
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  return rows.map((plan) => {
    const progressPercentage =
      plan.total_sessions > 0
        ? Math.round((plan.completed_sessions / plan.total_sessions) * 100)
        : 0;

    const difficultyLevel =
      plan.difficulty_balance === "hard_heavy"
        ? "Hard"
        : plan.difficulty_balance === "easy_heavy"
        ? "Easy"
        : "Medium";

    return {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      recent_date: plan.updated_at,
      plan_modules: plan.module_names ? plan.module_names.split(",") : [],
      level: difficultyLevel,
      questions_count: `${plan.total_questions_correct}/${plan.total_questions_attempted}`,
      progress_percentage: progressPercentage,
    };
  });
}

// Get subject performance (simplified for now)
async function getSubjectPerformance(studentId) {
  const sql = `
    SELECT 
      m.module_id,
      m.subject_name,
      m.subject_color,
      0 as total_sessions,
      0 as total_questions,
      0 as total_time,
      0 as accuracy_percentage
    FROM student_enrollments se
    JOIN modules m ON se.module_id = m.module_id
    WHERE se.student_id = ? AND se.status = 'active'
    LIMIT 5
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  return rows.map((subject) => ({
    subject_name: subject.subject_name,
    questions_count: subject.total_questions,
    time_spent: Math.round(subject.total_time / 60), // Convert to hours
    accuracy_percentage: subject.accuracy_percentage,
    subject_color: subject.subject_color,
  }));
}

// Get weak topics focus (simplified - no flashcard data yet)
async function getWeakTopicsFocus(studentId) {
  const sql = `
    SELECT 
      t.topic_id,
      t.topic_name,
      'General' as module_name,
      65 as accuracy_percentage,
      20 as questions_count
    FROM topics t
    WHERE t.status = 'active'
    LIMIT 5
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  return rows.map((topic) => ({
    topic_name: topic.topic_name,
    module_name: topic.module_name,
    accuracy_percentage: topic.accuracy_percentage,
    questions_count: topic.questions_count,
  }));
}

// Get group leaderboard (from student points)
async function getGroupLeaderboard(studentId) {
  const sql = `
    SELECT 
      s.student_id,
      s.full_name,
      SUBSTRING(s.full_name, 1, 2) as initials,
      COALESCE(SUM(sp.points_earned), 0) as total_points
    FROM students s
    LEFT JOIN student_points sp ON sp.student_id = s.student_id
    WHERE s.status = 'active'
    GROUP BY s.student_id, s.full_name
    ORDER BY total_points DESC
    LIMIT 10
  `;

  const [rows] = isMysql ? await client.execute(sql) : await client.query(sql);

  return rows.map((student, index) => ({
    rank: index + 1,
    student_id: student.student_id,
    student_name: student.full_name,
    student_initials: student.initials,
    total_points: student.total_points,
  }));
}

// Get recent activity (automatic from activity logs)
async function getRecentActivity(studentId) {
  const sql = `
    SELECT 
      sal.activity_type,
      sal.activity_description,
      sal.module_name,
      sal.topic_name,
      sal.score_percentage,
      sal.points_earned,
      sal.created_at,
      s.full_name
    FROM student_activity_log sal
    JOIN students s ON sal.student_id = s.student_id
    WHERE s.status = 'active' AND sal.student_id = ?
    ORDER BY sal.created_at DESC
    LIMIT 10
  `;

  const [rows] = isMysql ? await client.execute(sql, [studentId]) : await client.query(sql, [studentId]);

  return rows.map((activity) => ({
    student_name: activity.full_name,
    activity_description: activity.activity_description,
    score_percentage: activity.score_percentage,
    time_ago: getTimeAgo(activity.created_at),
    is_current_student: true, // Since we're filtering by studentId, all results are for current student
  }));
}

// Get student's recent activities (for personal dashboard)
async function getStudentRecentActivities(studentId) {
  return await activityTracking.getStudentRecentActivities(studentId);
}

// Get student's total points
async function getStudentPoints(studentId) {
  return await activityTracking.getStudentPoints(studentId);
}

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Get complete home page data (all automatic)
async function getHomePageData(studentId) {
  try {
    // Get all home page data in parallel (all automatic calculations)
    const [
      dailyQuote,
      streak,
      todayActivity,
      dailyPlanProgress,
      continueWhereLeftOff,
      subjectPerformance,
      weakTopicsFocus,
      groupLeaderboard,
      recentActivity,
      studentPoints,
    ] = await Promise.all([
      getDailyQuote(),
      getStudentStreak(studentId),
      getTodayActivity(studentId),
      getDailyPlanProgress(studentId),
      getContinueWhereLeftOff(studentId),
      getSubjectPerformance(studentId),
      getWeakTopicsFocus(studentId),
      getGroupLeaderboard(studentId),
      getRecentActivity(studentId),
      getStudentPoints(studentId),
    ]);

    return {
      quote: dailyQuote,
      day_streak: streak,
      today_activity: todayActivity,
      daily_plan: dailyPlanProgress,
      continue_where_left_off: continueWhereLeftOff,
      subject_performance: subjectPerformance,
      weak_topics_focus: weakTopicsFocus,
      group_leaderboard: groupLeaderboard,
      recent_activity: recentActivity,
      total_points: studentPoints,
    };
  } catch (error) {
    console.error("Error fetching home page data:", error);
    throw error;
  }
}

module.exports = {
  getDailyQuote,
  getStudentStreak,
  getTodayActivity,
  getDailyPlanProgress,
  getContinueWhereLeftOff,
  getSubjectPerformance,
  getWeakTopicsFocus,
  getGroupLeaderboard,
  getRecentActivity,
  getStudentRecentActivities,
  getStudentPoints,
  getHomePageData,
};
