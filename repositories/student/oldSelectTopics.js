async function getTopicsBySubject({ moduleId, studentId }) {
    let unitIds = moduleId;
    if (typeof unitIds === "string") {
      unitIds = unitIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (!Array.isArray(unitIds)) {
      unitIds = [unitIds];
    }
  
    if (!unitIds || !unitIds.length) return [];
  
    const placeholders = unitIds.map(() => "?").join(",");
    const params = [...unitIds];
  
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
        ${
          studentId
            ? `
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
        `
            : `
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
        `
        }
      FROM topics t
      LEFT JOIN units u ON u.unit_id = t.unit_id
      LEFT JOIN questions q ON q.topic_id = t.topic_id
      LEFT JOIN flashcards f ON f.topic_id = t.topic_id
      ${
        studentId
          ? `
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
      `
          : ""
      }
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
  
    if (!studentId || !topicRows.length) return topicRows;
  
    const topicIds = topicRows.map((row) => row.topic_id);
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
  
    const questionsByTopic = {};
    questionRows.forEach((q) => {
      if (!questionsByTopic[q.topic_id]) {
        questionsByTopic[q.topic_id] = [];
      }
      questionsByTopic[q.topic_id].push({
        question_id: q.question_id,
        difficulty: q.difficulty,
        attempted: !!q.attempted,
        correct: !!q.correct,
        marked: !!q.marked,
      });
    });
  
    return topicRows.map((topic) => {
      const distinct = questionsByTopic[topic.topic_id]
        ? [
            ...new Map(
              questionsByTopic[topic.topic_id].map((item) => [
                item.question_id,
                item,
              ])
            ).values(),
          ]
        : [];
  
      topic.wrong_count =
        distinct?.filter((item) => !item?.correct && item?.attempted)?.length ||
        0;
      topic.correct_count =
        distinct?.filter((item) => item?.correct && item?.attempted)?.length || 0;
      topic.unsolved_count =
        distinct?.filter((item) => !item?.attempted)?.length || 0;
      topic.marked_count = distinct?.filter((item) => item?.marked)?.length || 0;
  
      return {
        ...topic,
        questions: distinct || [],
      };
    });
  }