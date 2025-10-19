const { client } = require("../../config/db-connect");

/**
 * Optimized version of getDashboardOverview function
 * Uses Promise.all for parallel queries and combines related queries
 */
async function getOptimizedDashboardOverview({ studentId }) {
  try {
    // Execute multiple queries in parallel to reduce overall response time
    const [
      plansPromise,
      combinedStatsPromise,
      recentActivityPromise,
      upcomingDeadlinesPromise
    ] = await Promise.all([
      // Get active study plan
      client.execute(
        `SELECT * FROM student_study_plans 
         WHERE student_id = ? AND status = 'active' 
         ORDER BY updated_at DESC LIMIT 1`,
        [studentId]
      ),
      
      // Combined stats query (questions, study time, healthcare mastery, next exam)
      client.execute(
        `SELECT 
           (SELECT COUNT(*) FROM solved_questions WHERE student_id = ?) as total_answered,
           (SELECT SUM(CASE WHEN is_correct = '1' THEN 1 ELSE 0 END) FROM solved_questions WHERE student_id = ?) as total_correct,
           (SELECT SUM(time_spent) FROM student_plan_sessions WHERE plan_id IN (SELECT plan_id FROM student_study_plans WHERE student_id = ?)) as total_time_spent,
           (SELECT MIN(scheduled_date) FROM exams e INNER JOIN student_enrollments se ON se.module_id = e.subject_id 
            WHERE se.student_id = ? AND e.scheduled_date >= CURRENT_DATE() AND e.status = 'active') as next_exam_date,
           (SELECT COUNT(DISTINCT t.topic_id) FROM topics t 
            INNER JOIN questions q ON q.topic_id = t.topic_id
            INNER JOIN units u ON u.unit_id = t.unit_id
            INNER JOIN modules m ON m.module_id = u.module_id
            WHERE m.status = 'active' AND t.status = 'active') as total_topics,
           (SELECT COUNT(DISTINCT t.topic_id) FROM topics t 
            INNER JOIN questions q ON q.topic_id = t.topic_id
            INNER JOIN solved_questions sq ON sq.question_id = q.question_id AND sq.student_id = ? AND sq.is_correct = '1'
            INNER JOIN units u ON u.unit_id = t.unit_id
            INNER JOIN modules m ON m.module_id = u.module_id
            WHERE m.status = 'active' AND t.status = 'active') as mastered_topics`,
        [studentId, studentId, studentId, studentId, studentId]
      ),
      
      // Get all recent activity in a single query with UNION
      client.execute(
        `(SELECT 
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
          LIMIT 5)
          
          UNION ALL
          
          (SELECT 
            'Studied Flashcard' as title,
            CONCAT(m.subject_name, ' - ', t.topic_name) as details,
            DATE_FORMAT(sfc.solved_at, '%h:%i %p') as time,
            CASE WHEN sfc.card_solved = '1' THEN '5' ELSE '2' END as points,
            sfc.solved_at as activity_time
          FROM student_flash_cards sfc
          INNER JOIN flashcards f ON f.flashcard_id = sfc.flashcard_id
          INNER JOIN topics t ON t.topic_id = f.topic_id
          INNER JOIN units u ON u.unit_id = t.unit_id
          INNER JOIN modules m ON m.module_id = u.module_id
          WHERE sfc.student_id = ?
          ORDER BY sfc.solved_at DESC
          LIMIT 5)
          
          UNION ALL
          
          (SELECT 
            'Took Exam' as title,
            e.title as details,
            DATE_FORMAT(ea.submitted_at, '%h:%i %p') as time,
            ROUND(ea.total_score * 10) as points,
            ea.submitted_at as activity_time
          FROM exam_attempts ea
          INNER JOIN exams e ON e.exam_id = ea.exam_id
          WHERE ea.student_id = ? AND ea.submitted_at IS NOT NULL
          ORDER BY ea.submitted_at DESC
          LIMIT 5)
          
          UNION ALL
          
          (SELECT 
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
          LIMIT 5)
          
          ORDER BY activity_time DESC
          LIMIT 5`,
        [studentId, studentId, studentId, studentId]
      ),
      
      // Get upcoming deadlines
      client.execute(
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
      )
    ]);
    
    // Process results from parallel queries
    const [plans] = plansPromise;
    const [combinedStats] = combinedStatsPromise;
    const [recentActivity] = recentActivityPromise;
    const [upcomingDeadlines] = upcomingDeadlinesPromise;
    
    const activePlan = plans.length > 0 ? plans[0] : null;
    const statsData = combinedStats[0] || {};
    
    // Get session stats if active plan exists
    let currentPlanProgress = { completed: 0, total: 0 };
    
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
    
    // Calculate days until exam
    const nextExamDate = statsData.next_exam_date ? new Date(statsData.next_exam_date) : null;
    const daysUntilExam = nextExamDate 
      ? Math.max(0, Math.ceil((nextExamDate - new Date()) / (1000 * 60 * 60 * 24))) 
      : 30; // Default to 30 days if no exam scheduled
    
    // Calculate accuracy
    const questionsAnswered = Number(statsData.total_answered) || 0;
    const questionsCorrect = Number(statsData.total_correct) || 0;
    const accuracy = questionsAnswered > 0 ? Math.round((questionsCorrect / questionsAnswered) * 100) : 0;
    
    // Calculate hours studied
    const totalMinutesStudied = Math.round((Number(statsData.total_time_spent) || 0) / 60);
    const hoursStudied = Math.round(totalMinutesStudied / 60 * 10) / 10; // Round to 1 decimal place
    
    // Map recent activity
    const allActivities = recentActivity.map(a => ({
      title: a.title || "",
      details: a.details || "",
      time: a.time || "",
      points: a.points || ""
    }));
    
    // Build response object
    return {
      currentPlan: currentPlanProgress,
      healthcareMastered: {
        completed: Number(statsData.mastered_topics) || 0,
        total: Number(statsData.total_topics) || 0
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
  } catch (error) {
    console.error('Error in getOptimizedDashboardOverview:', error);
    throw error;
  }
}

module.exports = {
  getOptimizedDashboardOverview
};