const { client } = require("../../config/db-connect");

// Get teacher dashboard overview stats
async function getTeacherDashboardOverview(teacherId) {
  // Get current stats
  const [currentStats] = await client.execute(
    `SELECT 
      (SELECT COUNT(DISTINCT tm.module_id)
       FROM teacher_modules tm
       WHERE tm.teacher_id = ? AND tm.status = 'active') AS modules,
      (SELECT COUNT(*)
       FROM exams e
       WHERE e.teacher_id = ?) AS exams_created,
      (SELECT COUNT(DISTINCT ea.student_id)
       FROM exam_attempts ea
       INNER JOIN exams e ON e.exam_id = ea.exam_id
       WHERE e.teacher_id = ?) AS students_participated,
      (SELECT COUNT(DISTINCT f.flashcard_id)
       FROM flashcards f
       INNER JOIN topics t ON t.topic_id = f.topic_id
       INNER JOIN units u ON u.unit_id = t.unit_id
       INNER JOIN teacher_modules tm ON tm.module_id = u.module_id
       WHERE tm.teacher_id = ? AND f.status = 'active') AS flashcards,
      (SELECT COUNT(DISTINCT eb.ebook_id)
       FROM ebooks eb
       INNER JOIN units u ON u.unit_id = eb.subject_id
       INNER JOIN teacher_modules tm ON tm.module_id = u.module_id
       WHERE tm.teacher_id = ? AND eb.is_deleted = 0) AS digital_library`,
    [teacherId, teacherId, teacherId, teacherId, teacherId]
  );

  // Get previous period stats for trends (last week for modules/exams, today for others)
  const [previousStats] = await client.execute(
    `SELECT 
      (SELECT COUNT(DISTINCT tm.module_id)
       FROM teacher_modules tm
       WHERE tm.teacher_id = ? 
         AND tm.status = 'active'
         AND tm.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS modules_week_ago,
      (SELECT COUNT(*)
       FROM exams e
       WHERE e.teacher_id = ? 
         AND e.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)) AS exams_month_ago,
      (SELECT COUNT(DISTINCT ea.student_id)
       FROM exam_attempts ea
       INNER JOIN exams e ON e.exam_id = ea.exam_id
       WHERE e.teacher_id = ?
         AND DATE(ea.started_at) < CURDATE()) AS students_yesterday,
      (SELECT COUNT(DISTINCT f.flashcard_id)
       FROM flashcards f
       INNER JOIN topics t ON t.topic_id = f.topic_id
       INNER JOIN units u ON u.unit_id = t.unit_id
       INNER JOIN teacher_modules tm ON tm.module_id = u.module_id
       WHERE tm.teacher_id = ? 
         AND f.status = 'active'
         AND DATE(f.created_at) < CURDATE()) AS flashcards_yesterday,
      (SELECT COUNT(DISTINCT eb.ebook_id)
       FROM ebooks eb
       INNER JOIN units u ON u.unit_id = eb.subject_id
       INNER JOIN teacher_modules tm ON tm.module_id = u.module_id
       WHERE tm.teacher_id = ?
         AND eb.is_deleted = 0
         AND DATE(eb.created_at) < CURDATE()) AS digital_library_yesterday`,
    [teacherId, teacherId, teacherId, teacherId, teacherId]
  );

  const currentData = currentStats[0] || {
    modules: 0,
    exams_created: 0,
    students_participated: 0,
    flashcards: 0,
    digital_library: 0
  };

  const previousData = previousStats[0] || {
    modules_week_ago: 0,
    exams_month_ago: 0,
    students_yesterday: 0,
    flashcards_yesterday: 0,
    digital_library_yesterday: 0
  };

  // Calculate trends for each stat
  const calculateTrend = (current, previous, type) => {
    const diff = current - previous;
    if (type === 'modules') {
      return diff > 0 ? `+${diff} this week` : diff === 0 ? 'No change this week' : `${diff} this week`;
    } else if (type === 'exams') {
      return diff > 0 ? `+${diff} this month` : diff === 0 ? 'No change this month' : `${diff} this month`;
    } else if (type === 'students') {
      return diff > 0 ? `+${diff} active today` : diff === 0 ? 'No change today' : `${diff} today`;
    } else if (type === 'flashcards') {
      return diff > 0 ? `+${diff} created today` : diff === 0 ? 'No change today' : `${diff} today`;
    } else if (type === 'library') {
      return diff > 0 ? `+${diff} resources added` : diff === 0 ? 'No change today' : `${diff} today`;
    }
    return '';
  };

  // Get recent activities matching the new format
  // Exam completions
  const [examCompletions] = await client.execute(
    `SELECT 
      CONCAT(e.title, ' completed by ', COUNT(DISTINCT ea.student_id), ' students') AS action,
      MAX(ea.submitted_at) AS activity_time,
      'exam' AS type
    FROM exam_attempts ea
    INNER JOIN exams e ON e.exam_id = ea.exam_id
    WHERE e.teacher_id = ?
      AND ea.status = 'submitted'
    GROUP BY e.exam_id
    ORDER BY MAX(ea.submitted_at) DESC
    LIMIT 2`,
    [teacherId]
  );

  // Recent questions added
  const [recentQuestions] = await client.execute(
    `SELECT 
      CONCAT('New question added to ', m.subject_name, ' bank') AS action,
      MAX(q.created_at) AS activity_time,
      'question' AS type
    FROM questions q
    INNER JOIN topics t ON t.topic_id = q.topic_id
    INNER JOIN units u ON u.unit_id = t.unit_id
    INNER JOIN modules m ON m.module_id = u.module_id
    INNER JOIN teacher_modules tm ON tm.module_id = m.module_id
    WHERE tm.teacher_id = ?
      AND q.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY m.module_id, m.subject_name
    ORDER BY MAX(q.created_at) DESC
    LIMIT 1`,
    [teacherId]
  );

  // Recent exam created
  const [recentExam] = await client.execute(
    `SELECT 
      CONCAT(e.title, ' created') AS action,
      e.created_at AS activity_time,
      'report' AS type
    FROM exams e
    WHERE e.teacher_id = ?
      AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY e.created_at DESC
    LIMIT 1`,
    [teacherId]
  );

  // Students joined classes
  const [studentsJoined] = await client.execute(
    `SELECT 
      CONCAT(COUNT(DISTINCT se.student_id), ' students joined ', m.subject_name, ' class') AS action,
      MAX(se.enrolled_at) AS activity_time,
      'exam' AS type
    FROM student_enrollments se
    INNER JOIN teacher_modules tm ON tm.module_id = se.module_id
    INNER JOIN modules m ON m.module_id = se.module_id
    WHERE tm.teacher_id = ?
      AND se.enrolled_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY se.module_id, m.subject_name
    ORDER BY MAX(se.enrolled_at) DESC
    LIMIT 1`,
    [teacherId]
  );

  // Combine all activities
  const allActivities = [
    ...examCompletions,
    ...recentQuestions,
    ...recentExam,
    ...studentsJoined
  ]
    .filter(a => a && a.activity_time)
    .sort((a, b) => new Date(b.activity_time) - new Date(a.activity_time))
    .slice(0, 4)
    .map(activity => ({
      action: activity.action,
      time: formatTimeAgo(activity.activity_time),
      type: activity.type
    }));

  // Get upcoming events (exams scheduled by this teacher)
  const [upcomingEvents] = await client.execute(
    `SELECT 
       e.title AS title,
       e.scheduled_date AS event_date,
       'exam' AS type,
       m.subject_name AS course
     FROM exams e
     LEFT JOIN modules m ON m.module_id = e.subject_id
     WHERE e.teacher_id = ?
       AND e.scheduled_date IS NOT NULL
       AND e.scheduled_date >= CURDATE()
       AND e.status IN ('published', 'scheduled')
     ORDER BY e.scheduled_date ASC
     LIMIT 3`,
    [teacherId]
  );

  // Get Performance Overview data - Average Score
  const [avgScoreData] = await client.execute(
    `SELECT 
      COALESCE(AVG(
        CASE 
          WHEN eq_count.total_questions > 0 
          THEN (ea.total_score * 100.0 / eq_count.total_questions)
          ELSE 0
        END
      ), 0) AS average_score
    FROM exam_attempts ea
    INNER JOIN exams e ON e.exam_id = ea.exam_id
    LEFT JOIN (
      SELECT exam_id, COUNT(*) as total_questions
      FROM exam_questions
      GROUP BY exam_id
    ) eq_count ON eq_count.exam_id = e.exam_id
    WHERE e.teacher_id = ?
      AND ea.status = 'submitted'
      AND ea.total_score IS NOT NULL`,
    [teacherId]
  );

  // Get Completion Rate
  const [completionData] = await client.execute(
    `SELECT 
      COUNT(DISTINCT CASE WHEN ea.status = 'submitted' THEN ea.exam_attempt_id END) AS completed,
      COUNT(DISTINCT ea.exam_attempt_id) AS total_attempts
    FROM exam_attempts ea
    INNER JOIN exams e ON e.exam_id = ea.exam_id
    WHERE e.teacher_id = ?`,
    [teacherId]
  );

  // Get top performing module/class
  const [topClass] = await client.execute(
    `SELECT 
      m.subject_name AS class_name,
      COALESCE(AVG(
        CASE 
          WHEN eq_count.total_questions > 0 
          THEN (ea.total_score * 100.0 / eq_count.total_questions)
          ELSE 0
        END
      ), 0) AS avg_score
    FROM exam_attempts ea
    INNER JOIN exams e ON e.exam_id = ea.exam_id
    LEFT JOIN modules m ON m.module_id = e.subject_id
    LEFT JOIN (
      SELECT exam_id, COUNT(*) as total_questions
      FROM exam_questions
      GROUP BY exam_id
    ) eq_count ON eq_count.exam_id = e.exam_id
    WHERE e.teacher_id = ?
      AND ea.status = 'submitted'
      AND ea.total_score IS NOT NULL
    GROUP BY m.module_id, m.subject_name
    ORDER BY avg_score DESC
    LIMIT 1`,
    [teacherId]
  );

  const averageScore = avgScoreData[0]?.average_score || 0;
  const completion = completionData[0] || { completed: 0, total_attempts: 0 };
  const completionRate = completion.total_attempts > 0 
    ? (completion.completed / completion.total_attempts) * 100 
    : 0;
  const topPerformingClass = topClass[0]?.class_name || 'N/A';

  return {
    stats: [
      {
        id: 1,
        title: 'Modules',
        value: String(currentData.modules || 0),
        trend: calculateTrend(currentData.modules, previousData.modules_week_ago, 'modules'),
        icon: 'BookOpen',
        color: 'text-[#0F7490]',
        bgGradient: 'from-[#0F7490]/10 to-[#0F7490]/5',
        borderColor: 'border-[#0F7490]/20'
      },
      {
        id: 2,
        title: 'Exams Created',
        value: String(currentData.exams_created || 0),
        trend: calculateTrend(currentData.exams_created, previousData.exams_month_ago, 'exams'),
        icon: 'FileText',
        color: 'text-[#C9AE6C]',
        bgGradient: 'from-[#C9AE6C]/10 to-[#C9AE6C]/5',
        borderColor: 'border-[#C9AE6C]/20'
      },
      {
        id: 3,
        title: 'Students Participated',
        value: String(currentData.students_participated || 0),
        trend: calculateTrend(currentData.students_participated, previousData.students_yesterday, 'students'),
        icon: 'Users',
        color: 'text-[#8B5CF6]',
        bgGradient: 'from-[#8B5CF6]/10 to-[#8B5CF6]/5',
        borderColor: 'border-[#8B5CF6]/20'
      },
      {
        id: 4,
        title: 'Flashcards',
        value: String(currentData.flashcards || 0),
        trend: calculateTrend(currentData.flashcards, previousData.flashcards_yesterday, 'flashcards'),
        icon: 'Layers',
        color: 'text-[#059669]',
        bgGradient: 'from-[#059669]/10 to-[#059669]/5',
        borderColor: 'border-[#059669]/20'
      },
      {
        id: 5,
        title: 'Digital Library',
        value: String(currentData.digital_library || 0),
        trend: calculateTrend(currentData.digital_library, previousData.digital_library_yesterday, 'library'),
        icon: 'Library',
        color: 'text-[#DC2626]',
        bgGradient: 'from-[#DC2626]/10 to-[#DC2626]/5',
        borderColor: 'border-[#DC2626]/20'
      }
    ],
    recentActivities: allActivities,
    performanceOverview: {
      averageScore: parseFloat(averageScore || 0).toFixed(1),
      completionRate: parseFloat(completionRate || 0).toFixed(1),
      topPerformingClass: topPerformingClass
    }
  };
}

// Helper function to format time ago
function formatTimeAgo(dateString) {
  if (!dateString) return 'Recently';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
}

// Helper function to format event date
function formatEventDate(dateString) {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Helper function to format large numbers
function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
}

module.exports = {
  getTeacherDashboardOverview
};

