const { client } = require("../../config/db-connect");

// Check if we're using MySQL (development) or PostgreSQL (production)
const isMysql = true;

// Log specific activity (called from other controllers)
async function logActivity({
  studentId,
  activityType,
  activityDescription,
  moduleName = null,
  topicName = null,
  scorePercentage = null,
  pointsEarned = 0,
  metadata = null,
}) {
  const sql = `
    INSERT INTO student_activity_log 
    (student_id, activity_type, activity_description, module_name, topic_name, score_percentage, points_earned, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  if (isMysql) {
    await client.execute(sql, [
      studentId,
      activityType,
      activityDescription,
      moduleName,
      topicName,
      scorePercentage,
      pointsEarned,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  } else {
    await client.query(sql, [
      studentId,
      activityType,
      activityDescription,
      moduleName,
      topicName,
      scorePercentage,
      pointsEarned,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  }

  // Automatically update daily activity and streak
  await updateDailyActivityFromLog(studentId);

  // Update leaderboard points if points were earned
  if (pointsEarned > 0) {
    await updateLeaderboardPoints(studentId, pointsEarned);
  }

  return true;
}

// Update daily activity automatically based on logged activities
async function updateDailyActivityFromLog(studentId) {
  const today = new Date().toISOString().split("T")[0];

  // Get today's activities from logs
  const activitiesSql = `
    SELECT 
      activity_type,
      COUNT(*) as count,
      SUM(points_earned) as total_points
    FROM student_activity_log 
    WHERE student_id = ? AND DATE(created_at) = ?
    GROUP BY activity_type
  `;

  const [activities] = isMysql
    ? await client.execute(activitiesSql, [studentId, today])
    : await client.query(activitiesSql, [studentId, today]);

  // Calculate totals
  let questionsAnswered = 0;
  let flashcardsStudied = 0;
  let timeSpent = 0;

  for (const activity of activities) {
    switch (activity.activity_type) {
      case "question_answered":
        questionsAnswered += activity.count;
        break;
      case "flashcard_studied":
        flashcardsStudied += activity.count;
        break;
      case "study_session":
        // Time spent is stored in metadata
        timeSpent += activity.count * 5; // Assume 5 minutes per session
        break;
    }
  }

  // Check if student has activity today
  const existingActivitySql =
    "SELECT * FROM student_daily_activity WHERE student_id = ? AND activity_date = ?";
  const [existingActivity] = isMysql
    ? await client.execute(existingActivitySql, [studentId, today])
    : await client.query(existingActivitySql, [studentId, today]);

  if (existingActivity && existingActivity.length > 0) {
    // Update existing activity
    const updateSql = `
      UPDATE student_daily_activity 
      SET questions_answered = ?, 
          flashcards_studied = ?, 
          time_spent = ?
      WHERE student_id = ? AND activity_date = ?
    `;
    if (isMysql) {
      await client.execute(updateSql, [
        questionsAnswered,
        flashcardsStudied,
        timeSpent,
        studentId,
        today,
      ]);
    } else {
      await client.query(updateSql, [
        questionsAnswered,
        flashcardsStudied,
        timeSpent,
        studentId,
        today,
      ]);
    }
  } else {
    // Create new daily activity and calculate streak
    const streakCount = await calculateStreak(studentId);

    const insertSql = `
      INSERT INTO student_daily_activity 
      (student_id, activity_date, questions_answered, flashcards_studied, time_spent, streak_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    if (isMysql) {
      await client.execute(insertSql, [
        studentId,
        today,
        questionsAnswered,
        flashcardsStudied,
        timeSpent,
        streakCount,
      ]);
    } else {
      await client.query(insertSql, [
        studentId,
        today,
        questionsAnswered,
        flashcardsStudied,
        timeSpent,
        streakCount,
      ]);
    }

    // Log streak activity if it's a new day
    if (streakCount > 0) {
      await logActivity({
        studentId,
        activityType: "daily_streak",
        activityDescription: `Daily streak: ${streakCount} days`,
        pointsEarned: streakCount * 10, // 10 points per day of streak
      });
    }
  }
}

// Calculate student's current streak based on daily activity
async function calculateStreak(studentId) {
  const sql = `
    SELECT DISTINCT DATE(activity_date) as activity_date
    FROM student_daily_activity 
    WHERE student_id = ? 
    ORDER BY activity_date DESC 
    LIMIT 30
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  if (rows.length === 0) return 1; // First day

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check consecutive days from today backwards
  for (let i = 0; i < rows.length; i++) {
    const activityDate = new Date(rows[i].activity_date);
    activityDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    // Check if dates match
    if (activityDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

// Update streak daily based on activity (call this daily via cron job)
async function updateDailyStreakFromActivity(studentId) {
  const today = new Date().toISOString().split("T")[0];

  // Check if student has any activity today
  const activityCheckSql = `
    SELECT COUNT(*) as activity_count
    FROM student_activity_log 
    WHERE student_id = ? AND DATE(created_at) = ?
  `;

  const [activityResult] = isMysql
    ? await client.execute(activityCheckSql, [studentId, today])
    : await client.query(activityCheckSql, [studentId, today]);

  const hasActivityToday = activityResult[0].activity_count > 0;

  if (hasActivityToday) {
    // Calculate new streak
    const newStreak = await calculateStreak(studentId);

    // Update or insert daily activity with new streak
    const upsertSql = `
      INSERT INTO student_daily_activity 
      (student_id, activity_date, streak_count, questions_answered, flashcards_studied, time_spent)
      VALUES (?, ?, ?, 0, 0, 0)
      ON DUPLICATE KEY UPDATE
      streak_count = VALUES(streak_count)
    `;

    if (isMysql) {
      await client.execute(upsertSql, [studentId, today, newStreak]);
    } else {
      await client.query(upsertSql, [studentId, today, newStreak]);
    }

    // Give streak bonus points (only once per day)
    const existingStreakActivity = `
      SELECT COUNT(*) as count
      FROM student_activity_log 
      WHERE student_id = ? AND activity_type = 'daily_streak' AND DATE(created_at) = ?
    `;

    const [streakCheck] = isMysql
      ? await client.execute(existingStreakActivity, [studentId, today])
      : await client.query(existingStreakActivity, [studentId, today]);

    if (streakCheck[0].count === 0 && newStreak > 0) {
      await logActivity({
        studentId,
        activityType: "daily_streak",
        activityDescription: `Daily streak: ${newStreak} days`,
        pointsEarned: newStreak * 5, // 5 points per day of streak
      });
    }
  }

  return hasActivityToday;
}

// Get student's current streak
async function getStudentStreak(studentId) {
  const sql =
    "SELECT streak_count FROM student_daily_activity WHERE student_id = ? ORDER BY activity_date DESC LIMIT 1";
  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  return rows.length > 0 ? rows[0].streak_count : 0;
}

// Get today's activity summary
async function getTodayActivity(studentId) {
  const today = new Date().toISOString().split("T")[0];

  const sql =
    "SELECT * FROM student_daily_activity WHERE student_id = ? AND activity_date = ?";
  const [rows] = isMysql
    ? await client.execute(sql, [studentId, today])
    : await client.query(sql, [studentId, today]);

  if (rows.length === 0) {
    return {
      questions_answered: 0,
      flashcards_studied: 0,
      time_spent: 0,
      streak_count: 0,
    };
  }

  return rows[0];
}

// Update leaderboard points
async function updateLeaderboardPoints(studentId, points) {
  const sql = `
    INSERT INTO student_leaderboard (student_id, total_points, weekly_points, monthly_points)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_points = total_points + VALUES(total_points),
      weekly_points = weekly_points + VALUES(weekly_points),
      monthly_points = monthly_points + VALUES(monthly_points),
      last_updated = CURRENT_TIMESTAMP
  `;

  if (isMysql) {
    await client.execute(sql, [studentId, points, points, points]);
  } else {
    await client.query(sql, [studentId, points, points, points]);
  }

  // Update rankings
  await updateLeaderboardRankings();
}

// Update leaderboard rankings
async function updateLeaderboardRankings() {
  const sql = `
    UPDATE student_leaderboard sl1
    SET rank_position = (
      SELECT COUNT(*) + 1 
      FROM student_leaderboard sl2 
      WHERE sl2.total_points > sl1.total_points
    )
    ORDER BY total_points DESC
  `;

  if (isMysql) {
    await client.execute(sql);
  } else {
    await client.query(sql);
  }
}

// Get student's total points
async function getStudentPoints(studentId) {
  const sql =
    "SELECT total_points FROM student_leaderboard WHERE student_id = ?";
  const [rows] = isMysql
    ? await client.execute(sql, [studentId])
    : await client.query(sql, [studentId]);

  return rows.length > 0 ? rows[0].total_points : 0;
}

// Get recent activities for a student
async function getStudentRecentActivities(studentId, limit = 10) {
  const sql = `
    SELECT 
      sal.activity_type,
      sal.activity_description,
      sal.module_name,
      sal.topic_name,
      sal.score_percentage,
      sal.points_earned,
      sal.created_at
    FROM student_activity_log sal
    WHERE sal.student_id = ?
    ORDER BY sal.created_at DESC
    LIMIT ?
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [studentId, limit])
    : await client.query(sql, [studentId, limit]);

  return rows.map((activity) => ({
    ...activity,
    time_ago: getTimeAgo(activity.created_at),
  }));
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

module.exports = {
  logActivity,
  updateDailyActivityFromLog,
  calculateStreak,
  updateDailyStreakFromActivity,
  getStudentStreak,
  getTodayActivity,
  updateLeaderboardPoints,
  getStudentPoints,
  getStudentRecentActivities,
};
