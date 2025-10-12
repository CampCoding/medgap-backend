const { client } = require("../../config/db-connect");

class QuestionsRepository {
  async createQuestion(questionData, createdBy = null) {
    try {
      const {
        question_text,
        question_type,
        topic_id,
        model_answer,
        difficulty_level = "medium",
        hint,
        keywords = [],
        tags = [],
        help_guidance,
        points = 1,
        status = "draft"
      } = questionData;

      // إنشاء السؤال
      const questionQuery = `
        INSERT INTO questions (
          question_text, question_type, topic_id, model_answer, 
          difficulty_level, hint, keywords, tags, help_guidance, 
          points, status, usage_count, acceptance_rate, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const questionValues = [
        question_text,
        question_type,
        topic_id || null,
        model_answer || null,
        difficulty_level,
        hint || null,
        JSON.stringify(keywords),
        JSON.stringify(tags),
        help_guidance || null,
        points,
        status,
        0, // usage_count
        0.0, // acceptance_rate
        createdBy,
        createdBy
      ];

      const [questionResult] = await client.execute(
        questionQuery,
        questionValues
      );
      const questionId = questionResult.insertId;

      // إنشاء خيارات السؤال إذا كان من نوع multiple_choice أو true_false
      if (
        (question_type === "multiple_choice" ||
          question_type === "true_false") &&
        questionData.options
      ) {
        await this.createQuestionOptions(
          questionId,
          questionData.options,
          createdBy
        );
      }

      // جلب السؤال المحدث مع خياراته
      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error creating question: ${error.message}`);
    }
  }

  // إنشاء خيارات السؤال
  async createQuestionOptions(questionId, options, createdBy = null) {
    try {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const optionQuery = `
          INSERT INTO question_options (
            question_id, option_text, is_correct, explanation, 
            video_explanation_url, option_order
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const optionValues = [
          questionId,
          option.option_text,
          option.is_correct ? 1 : 0,
          option.explanation || null,
          option.video_explanation_url || null,
          i + 1 // option_order
        ];

        await client.execute(optionQuery, optionValues);
      }
    } catch (error) {
      throw new Error(`Error creating question options: ${error.message}`);
    }
  }

  // جلب سؤال بواسطة ID
  async getQuestionById(questionId) {
    try {
      const query = `
        SELECT
          q.*,
          t.topic_name,
          a1.admin_name as created_by_name,
          a2.admin_name as updated_by_name
        FROM questions q
        LEFT JOIN topics t ON q.topic_id = t.topic_id
        LEFT JOIN admins a1 ON q.created_by = a1.admin_id
        LEFT JOIN admins a2 ON q.updated_by = a2.admin_id
        WHERE q.question_id = ?
      `;

      const [result] = await client.execute(query, [questionId]);

      if (result.length === 0) {
        return null;
      }

      const question = this.formatQuestion(result[0]);

      // جلب خيارات السؤال
      const optionsQuery = `
        SELECT * FROM question_options 
        WHERE question_id = ? 
        ORDER BY option_order ASC
      `;
      const [optionsResult] = await client.execute(optionsQuery, [questionId]);

      question.options = optionsResult.map((option) => ({
        option_id: option.option_id,
        option_text: option.option_text,
        is_correct: Boolean(option.is_correct),
        explanation: option.explanation,
        video_explanation_url: option.video_explanation_url,
        option_order: option.option_order
      }));

      return question;
    } catch (error) {
      throw new Error(`Error fetching question: ${error.message}`);
    }
  }

  // جلب خيارات سؤال فقط
  async getQuestionOptions(questionId) {
    try {
      const optionsQuery = `
        SELECT * FROM question_options 
        WHERE question_id = ? 
        ORDER BY option_order ASC
      `;
      const [optionsResult] = await client.execute(optionsQuery, [questionId]);
      return optionsResult.map((option) => ({
        option_id: option.option_id,
        option_text: option.option_text,
        is_correct: Boolean(option.is_correct),
        explanation: option.explanation,
        video_explanation_url: option.video_explanation_url,
        option_order: option.option_order
      }));
    } catch (error) {
      throw new Error(`Error fetching question options: ${error.message}`);
    }
  }

  async getAllQuestions(filters = {}) {
    let query = `
      SELECT
        q.*,
    
  COALESCE(
  JSON_ARRAYAGG(
    CASE
      WHEN qo.option_id IS NOT NULL THEN JSON_OBJECT(
        'option_id',   qo.option_id,
        'option_text', qo.option_text,
        'is_correct',  qo.is_correct,
        'explanation', qo.explanation
      )
    END
  ),
  JSON_ARRAY()
) AS answers,

        t.topic_name,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name,
        COUNT(DISTINCT qo.option_id) as options_count
      FROM questions q
      LEFT JOIN topics t ON q.topic_id = t.topic_id
      LEFT JOIN admins a1 ON q.created_by = a1.admin_id
      LEFT JOIN admins a2 ON q.updated_by = a2.admin_id
      LEFT JOIN question_options qo ON q.question_id = qo.question_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND q.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.question_type) {
      query += ` AND q.question_type = ?`;
      values.push(filters.question_type);
    }
    if (filters.difficulty_level) {
      query += ` AND q.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.status) {
      query += ` AND q.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (q.question_text LIKE ? OR q.hint LIKE ? OR q.help_guidance LIKE ?)`;
      values.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags
        .map(() => `JSON_CONTAINS(q.tags, JSON_QUOTE(?))`)
        .join(" AND ");
      query += ` AND (${tagConditions})`;
      values.push(...filters.tags);
    }

    query += ` GROUP BY q.question_id, t.topic_name, a1.admin_name, a2.admin_name`;
    query += ` ORDER BY q.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      values.push(filters.limit);
    }
    if (filters.offset) {
      query += ` OFFSET ?`;
      values.push(filters.offset);
    }

    try {
      const [result] = await client.execute(query, values);
      result.map((item) => {
        item.answers = JSON.parse(item.answers)?.filter((item) => item);
        console.log(item.answers?.length);
        return item;
      });
      return result.map((row) => this.formatQuestion(row));
    } catch (error) {
      throw new Error(`Error fetching questions: ${error.message}`);
    }
  }

  // إحصائيات الأسئلة المجمعة
  async getQuestionsStats() {
    try {
      const queries = {
        total: `SELECT COUNT(*) AS c FROM questions`,
        active: `SELECT COUNT(*) AS c FROM questions WHERE status = 'active'`,
        mc: `SELECT COUNT(*) AS c FROM questions WHERE question_type = 'multiple_choice'`,
        tf: `SELECT COUNT(*) AS c FROM questions WHERE question_type = 'true_false'`,
        essay: `SELECT COUNT(*) AS c FROM questions WHERE question_type = 'essay'`,
        easy: `SELECT COUNT(*) AS c FROM questions WHERE difficulty_level = 'easy'`,
        medium: `SELECT COUNT(*) AS c FROM questions WHERE difficulty_level = 'medium'`,
        hard: `SELECT COUNT(*) AS c FROM questions WHERE difficulty_level = 'hard'`,
        usageSum: `SELECT COALESCE(SUM(usage_count),0) AS s FROM questions`,
        acceptanceAvg: `SELECT COALESCE(AVG(acceptance_rate),0) AS a FROM questions`,
        independent: `SELECT COUNT(*) AS c FROM questions WHERE topic_id IS NULL`,
        createdThisWeek: `SELECT COUNT(*) AS c FROM questions WHERE YEARWEEK(created_at, 1) = YEARWEEK(NOW(), 1)`
      };

      const [
        [total],
        [active],
        [mc],
        [tf],
        [essay],
        [easy],
        [medium],
        [hard],
        [usageSum],
        [acceptanceAvg],
        [independent],
        [createdThisWeek]
      ] = await Promise.all([
        client.execute(queries.total, []).then(([r]) => r),
        client.execute(queries.active, []).then(([r]) => r),
        client.execute(queries.mc, []).then(([r]) => r),
        client.execute(queries.tf, []).then(([r]) => r),
        client.execute(queries.essay, []).then(([r]) => r),
        client.execute(queries.easy, []).then(([r]) => r),
        client.execute(queries.medium, []).then(([r]) => r),
        client.execute(queries.hard, []).then(([r]) => r),
        client.execute(queries.usageSum, []).then(([r]) => r),
        client.execute(queries.acceptanceAvg, []).then(([r]) => r),
        client.execute(queries.independent, []).then(([r]) => r),
        client.execute(queries.createdThisWeek, []).then(([r]) => r)
      ]);

      const totalQuestions = parseInt(total.c) || 0;
      const totalUsage = parseInt(usageSum.s) || 0;
      const avgUsage = totalQuestions > 0 ? totalUsage / totalQuestions : 0;
      const overallAcceptance = parseFloat(acceptanceAvg.a) || 0;

      return {
        total_questions: totalQuestions,
        active_questions: parseInt(active.c) || 0,
        multiple_choice_count: parseInt(mc.c) || 0,
        true_false_count: parseInt(tf.c) || 0,
        essay_count: parseInt(essay.c) || 0,
        easy_count: parseInt(easy.c) || 0,
        medium_count: parseInt(medium.c) || 0,
        hard_count: parseInt(hard.c) || 0,
        total_usage: totalUsage,
        avg_usage_per_question: parseFloat(avgUsage.toFixed(2)),
        overall_acceptance_rate: parseFloat(overallAcceptance.toFixed(2)),
        independent_questions: parseInt(independent.c) || 0,
        created_this_week: parseInt(createdThisWeek.c) || 0
      };
    } catch (error) {
      throw new Error(`Error fetching questions stats: ${error.message}`);
    }
  }

  // استرجاع الأسئلة المتاحة للاستخدام (مثلاً المعتمدة والفعالة)
  async getAvailableQuestions(filters = {}) {
    try {
      const baseFilters = { ...filters, status: 'active' };
      return await this.getAllQuestions(baseFilters);
    } catch (error) {
      throw new Error(`Error fetching available questions: ${error.message}`);
    }
  }

  // تحديث حالة الموافقة/الحالة لسؤال
  async updateQuestionStatus(questionId, status, updatedBy = null) {
    try {
      console.log([status, updatedBy, questionId])
      const query = `UPDATE questions SET status = ?, updated_at = NOW() WHERE question_id = ?`;
      await client.execute(query, [status, questionId]);
      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error updating question status: ${error.message}`);
    }
  }

  // تحديث إحصائيات الاستخدام لسؤال
  async updateQuestionUsage(questionId, usageData = {}, updatedBy = null) {
    try {
      const { increment = 0, acceptance_rate } = usageData;

      const updates = [];
      const values = [];

      if (increment && Number(increment) !== 0) {
        updates.push(`usage_count = usage_count + ?`);
        values.push(Number(increment));
      }
      if (acceptance_rate !== undefined) {
        updates.push(`acceptance_rate = ?`);
        values.push(Number(acceptance_rate));
      }

      if (updates.length === 0) {
        return await this.getQuestionById(questionId);
      }

      updates.push(`updated_by = ?`, `updated_at = NOW()`);
      values.push(updatedBy, questionId);

      const query = `UPDATE questions SET ${updates.join(', ')} WHERE question_id = ?`;
      await client.execute(query, values);
      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error updating question usage: ${error.message}`);
    }
  }

  // إحصائيات استخدام سؤال محدد
  async getQuestionUsageStats(questionId) {
    try {
      const [rows] = await client.execute(
        `SELECT usage_count, acceptance_rate FROM questions WHERE question_id = ?`,
        [questionId]
      );
      if (!rows || rows.length === 0) {
        return null;
      }
      return {
        usage_count: parseInt(rows[0].usage_count) || 0,
        acceptance_rate: parseFloat(rows[0].acceptance_rate) || 0
      };
    } catch (error) {
      throw new Error(`Error fetching question usage stats: ${error.message}`);
    }
  }

  // أسئلة موضوع معين
  async getQuestionsByTopicId(topicId, filters = {}) {
    try {
      const allFilters = {
        ...filters,
        topic_id: topicId
      };
      return await this.getAllQuestions(allFilters);
    } catch (error) {
      throw new Error(`Error fetching questions for topic: ${error.message}`);
    }
  }

  // عدد الأسئلة الإجمالي
  async getQuestionsCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT q.question_id) as total
      FROM questions q
      LEFT JOIN topics t ON q.topic_id = t.topic_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND q.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.question_type) {
      query += ` AND q.question_type = ?`;
      values.push(filters.question_type);
    }
    if (filters.difficulty_level) {
      query += ` AND q.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.status) {
      query += ` AND q.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (q.question_text LIKE ? OR q.hint LIKE ? OR q.help_guidance LIKE ?)`;
      values.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags
        .map(() => `JSON_CONTAINS(q.tags, JSON_QUOTE(?))`)
        .join(" AND ");
      query += ` AND (${tagConditions})`;
      values.push(...filters.tags);
    }

    try {
      const [result] = await client.execute(query, values);
      return parseInt(result[0].total) || 0;
    } catch (error) {
      throw new Error(`Error counting questions: ${error.message}`);
    }
  }

  // تحديث سؤال
  async updateQuestion(questionId, questionData, updatedBy = null) {
    try {
      const {
        question_text,
        question_type,
        topic_id,
        model_answer,
        difficulty_level,
        hint,
        keywords,
        tags,
        help_guidance,
        points,
        status,
        options
      } = questionData;

      const updateFields = [];
      const values = [];

      if (question_text !== undefined) {
        updateFields.push("question_text = ?");
        values.push(question_text);
      }
      if (question_type !== undefined) {
        updateFields.push("question_type = ?");
        values.push(question_type);
      }
      if (topic_id !== undefined) {
        updateFields.push("topic_id = ?");
        values.push(topic_id || null);
      }
      if (model_answer !== undefined) {
        updateFields.push("model_answer = ?");
        values.push(model_answer || null);
      }
      if (difficulty_level !== undefined) {
        updateFields.push("difficulty_level = ?");
        values.push(difficulty_level);
      }
      if (hint !== undefined) {
        updateFields.push("hint = ?");
        values.push(hint || null);
      }
      if (keywords !== undefined) {
        updateFields.push("keywords = ?");
        values.push(JSON.stringify(keywords));
      }
      if (tags !== undefined) {
        updateFields.push("tags = ?");
        values.push(JSON.stringify(tags));
      }
      if (help_guidance !== undefined) {
        updateFields.push("help_guidance = ?");
        values.push(help_guidance || null);
      }
      if (points !== undefined) {
        updateFields.push("points = ?");
        values.push(points);
      }
      if (status !== undefined) {
        updateFields.push("status = ?");
        values.push(status);
      }

      if (updateFields.length === 0) {
        throw new Error("No fields to update");
      }

      updateFields.push("updated_by = ?", "updated_at = NOW()");
      values.push(updatedBy, questionId);

      const query = `UPDATE questions SET ${updateFields.join(
        ", "
      )} WHERE question_id = ?`;
      await client.execute(query, values);

      // تحديث خيارات السؤال بشكل تفاضلي إذا تم توفيرها
      if (Array.isArray(options)) {
        // احضر الخيارات الحالية لحساب الترتيب القادم إذا لزم
        const [existingOptions] = await client.execute(
          "SELECT option_id, option_order FROM question_options WHERE question_id = ? ORDER BY option_order ASC",
          [questionId]
        );
        let nextOrder = (existingOptions?.length || 0) + 1;

        for (const opt of options) {
          const hasId = opt && opt.option_id;
          const markedDelete = Boolean(opt && (opt._delete || opt.delete));

          if (hasId && markedDelete) {
            // حذف خيار موجود
            await client.execute(
              "DELETE FROM question_options WHERE question_id = ? AND option_id = ?",
              [questionId, opt.option_id]
            );
            continue;
          }

          if (hasId && !markedDelete) {
            // تحديث خيار موجود
            const updateFields = [];
            const optValues = [];
            if (opt.option_text !== undefined) {
              updateFields.push("option_text = ?");
              optValues.push(opt.option_text);
            }
            if (opt.is_correct !== undefined) {
              updateFields.push("is_correct = ?");
              optValues.push(opt.is_correct ? 1 : 0);
            }
            if (opt.explanation !== undefined) {
              updateFields.push("explanation = ?");
              optValues.push(opt.explanation || null);
            }
            if (opt.video_explanation_url !== undefined) {
              updateFields.push("video_explanation_url = ?");
              optValues.push(opt.video_explanation_url || null);
            }
            if (opt.option_order !== undefined) {
              updateFields.push("option_order = ?");
              optValues.push(opt.option_order);
            }
            if (updateFields.length > 0) {
              optValues.push(questionId, opt.option_id);
              const updateQuery = `UPDATE question_options SET ${updateFields.join(", ")} WHERE question_id = ? AND option_id = ?`;
              await client.execute(updateQuery, optValues);
            }
            continue;
          }

          if (!hasId && !markedDelete) {
            // إضافة خيار جديد
            const insertQuery = `
              INSERT INTO question_options (
                question_id, option_text, is_correct, explanation,
                video_explanation_url, option_order
              ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            const insertValues = [
              questionId,
              opt.option_text,
              opt.is_correct ? 1 : 0,
              opt.explanation || null,
              opt.video_explanation_url || null,
              opt.option_order !== undefined ? opt.option_order : nextOrder++
            ];
            await client.execute(insertQuery, insertValues);
            continue;
          }
        }
      }

      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error updating question: ${error.message}`);
    }
  }

  // تحديث خيار سؤال واحد
  async updateQuestionOption(questionId, optionId, optionData = {}) {
    try {
      const {
        option_text,
        is_correct,
        explanation,
        video_explanation_url,
        option_order
      } = optionData;

      const updateFields = [];
      const values = [];

      if (option_text !== undefined) {
        updateFields.push("option_text = ?");
        values.push(option_text);
      }
      if (is_correct !== undefined) {
        updateFields.push("is_correct = ?");
        values.push(is_correct ? 1 : 0);
      }
      if (explanation !== undefined) {
        updateFields.push("explanation = ?");
        values.push(explanation || null);
      }
      if (video_explanation_url !== undefined) {
        updateFields.push("video_explanation_url = ?");
        values.push(video_explanation_url || null);
      }
      if (option_order !== undefined) {
        updateFields.push("option_order = ?");
        values.push(option_order);
      }

      if (updateFields.length === 0) {
        // لا تحديثات مطلوبة
        return await this.getQuestionById(questionId);
      }

      values.push(questionId, optionId);
      const query = `UPDATE question_options SET ${updateFields.join(", ")} WHERE question_id = ? AND option_id = ?`;
      await client.execute(query, values);

      // أرجع السؤال مع خياراته بعد التحديث
      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error updating question option: ${error.message}`);
    }
  }

  // حذف خيار سؤال واحد
  async deleteQuestionOption(questionId, optionId) {
    try {
      await client.execute(
        `DELETE FROM question_options WHERE question_id = ? AND option_id = ?`,
        [questionId, optionId]
      );
      // أعد السؤال بعد الحذف
      return await this.getQuestionById(questionId);
    } catch (error) {
      throw new Error(`Error deleting question option: ${error.message}`);
    }
  }

  // حذف سؤال (soft delete)
  async deleteQuestion(questionId, deletedBy = null) {
    try {
      const query = `
       DELETE FROM questions 
        
        WHERE question_id = ?
      `;
      console.log("questionId", questionId)
      await client.execute(query, [questionId]);
      return { success: true, message: "Question deleted successfully" };
    } catch (error) {
      throw new Error(`Error deleting question: ${error.message}`);
    }
  }

  // حذف سؤال نهائياً
  async permanentDeleteQuestion(questionId) {
    try {
      // حذف خيارات السؤال أولاً
      await client.execute(
        "DELETE FROM question_options WHERE question_id = ?",
        [questionId]
      );

      // حذف السؤال نهائياً
      await client.execute("DELETE FROM questions WHERE question_id = ?", [
        questionId
      ]);

      return { success: true, message: "Question permanently deleted" };
    } catch (error) {
      throw new Error(`Error permanently deleting question: ${error.message}`);
    }
  }

  // نسخ سؤال
  async duplicateQuestion(originalQuestionId, createdBy = null) {
    try {
      const originalQuestion = await this.getQuestionById(originalQuestionId);
      if (!originalQuestion) {
        throw new Error("Original question not found");
      }

      // إنشاء نسخة من السؤال
      const duplicateData = {
        question_text: originalQuestion.question_text + " (نسخة)",
        question_type: originalQuestion.question_type,
        topic_id: originalQuestion.topic_id,
        model_answer: originalQuestion.model_answer,
        difficulty_level: originalQuestion.difficulty_level,
        hint: originalQuestion.hint,
        keywords: originalQuestion.keywords,
        tags: originalQuestion.tags,
        help_guidance: originalQuestion.help_guidance,
        points: originalQuestion.points,
        status: "draft",
        options: originalQuestion.options
      };

      const duplicateQuestion = await this.createQuestion(
        duplicateData,
        createdBy
      );

      // تسجيل العلاقة في جدول النسخ
      const duplicateQuery = `
        INSERT INTO question_duplicates (original_question_id, duplicate_question_id, created_by)
        VALUES (?, ?, ?)
      `;
      await client.execute(duplicateQuery, [
        originalQuestionId,
        duplicateQuestion.question_id,
        createdBy
      ]);

      return duplicateQuestion;
    } catch (error) {
      throw new Error(`Error duplicating question: ${error.message}`);
    }
  }

  // تنسيق بيانات السؤال
  formatQuestion(question) {
    if (!question) return null;

    return {
      ...question,
      keywords: question.keywords ? JSON.parse(question.keywords) : [],
      tags: question.tags ? JSON.parse(question.tags) : [],
      options_count: parseInt(question.options_count) || 0
    };
  }
}

module.exports = new QuestionsRepository();
