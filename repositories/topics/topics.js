const { client } = require("../../config/db-connect");

class TopicsRepository {
  // إنشاء موضوع جديد
  async createTopic(topicData, createdBy = null) {
    const {
      unit_id,
      topic_name,
      short_description,
      learning_objectives,
      topic_order,
      status,
      tags,
      teacher_id
    } = topicData;
    console.log(topicData);
    const query = `
      INSERT INTO topics (
        unit_id, topic_name, short_description, learning_objectives, topic_order, status, tags, created_by, teacher_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      unit_id || null,
      topic_name,
      short_description || null,
      learning_objectives || null,
      topic_order || 1,
      status || "active",
      tags ? JSON.stringify(tags) : null,
      createdBy,
      teacher_id
    ];

    try {
      const [result] = await client.execute(query, values);
      const [newTopic] = await client.execute(
        "SELECT * FROM topics WHERE topic_id = LAST_INSERT_ID()"
      );
      return this.formatTopic(newTopic[0]);
    } catch (error) {
      throw new Error(`Error creating topic: ${error.message}`);
    }
  }

  // جميع الموضوعات مع الإحصائيات
  async getAllTopics(filters = {}) {
    let query = null;
    if (filters?.teacher_id) {
      query = `
      SELECT
        t.*,
        u.unit_name,
        m.subject_name as module_name,
        a1.full_name as created_by_name,
        COUNT(DISTINCT q.question_id) as questions_count,
        COUNT(DISTINCT f.flashcard_id) as flashcards_count,
        COUNT(DISTINCT dl.library_id) as library_files_count
      FROM topics t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN modules m ON u.module_id = m.module_id
      LEFT JOIN teachers a1 ON t.created_by = a1.teacher_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      LEFT JOIN flashcards f ON t.topic_id = f.topic_id
      LEFT JOIN digital_library dl ON t.topic_id = dl.topic_id
      WHERE ${filters?.unit_id ? `AND t.unit_id = ${filters?.unit_id}` : ''} ${filters?.teacher_id ? `AND t.teacher_id = ${filters?.teacher_id}` : ''} AND 1 = 1
    `;
    } else {
      query = `
      SELECT
        t.*,
        u.unit_name,
        m.subject_name as module_name,
        a1.full_name as created_by_name,
        COUNT(DISTINCT q.question_id) as questions_count,
        COUNT(DISTINCT f.flashcard_id) as flashcards_count,
        COUNT(DISTINCT dl.library_id) as library_files_count
      FROM topics t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN modules m ON u.module_id = m.module_id
      LEFT JOIN teachers a1 ON t.created_by = a1.teacher_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      LEFT JOIN flashcards f ON t.topic_id = f.topic_id
      LEFT JOIN digital_library dl ON t.topic_id = dl.topic_id
      WHERE ${filters?.unit_id ? `AND t.unit_id = ${filters?.unit_id}` : ''} ${filters?.teacher_id ? `AND t.teacher_id = ${filters?.teacher_id}` : ''} AND 1 = 1
    `;
    }

    let values = [filters?.teacher_id];
    if (!filters?.teacher_id) {
      values = []
    }

    if (filters.status) {
      query += ` AND t.status = ?`;
      values.push(filters.status);
    }
    if (filters.unit_id) {
      query += ` AND t.unit_id = ?`;
      values.push(filters.unit_id);
    }
    if (filters.search) {
      query += ` AND (t.topic_name LIKE ? OR t.short_description LIKE ? OR t.learning_objectives LIKE ?)`;
      values.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags
        .map(() => `JSON_CONTAINS(t.tags, JSON_QUOTE(?))`)
        .join(" AND ");
      query += ` AND (${tagConditions})`;
      values.push(...filters.tags);
    }

    query += ` GROUP BY t.topic_id, u.unit_name, m.subject_name, a1.full_name`;
    query += ` ORDER BY t.topic_order ASC, t.created_at DESC`;

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
      return result.map((row) => ({
        ...this.formatTopic(row),
        questions_count: parseInt(row.questions_count) || 0,
        flashcards_count: parseInt(row.flashcards_count) || 0,
        library_files_count: parseInt(row.library_files_count) || 0
      }));
    } catch (error) {
      throw new Error(`Error fetching topics: ${error.message}`);
    }
  }

  // موضوع بواسطة ID مع التفاصيل الكاملة
  async getTopicById(topicId, teacherId) {
    const query = `
      SELECT
        t.*,
        u.unit_name,
        m.subject_name as module_name,
        a1.full_name,
        a1.email,
        a1.phone,
        CONCAT('https://camp-coding.site/medgap/uploads/teachers/', a1.image_url) as teacher_image,
        COUNT(DISTINCT q.question_id) as questions_count,
        COUNT(DISTINCT f.flashcard_id) as flashcards_count,
        COUNT(DISTINCT dl.library_id) as library_files_count
      FROM topics t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      LEFT JOIN modules m ON u.module_id = m.module_id
      LEFT JOIN teachers a1 ON t.teacher_id = a1.teacher_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      LEFT JOIN flashcards f ON t.topic_id = f.topic_id
      LEFT JOIN digital_library dl ON t.topic_id = dl.topic_id
      WHERE t.topic_id = ? AND t.teacher_id = '${teacherId}'
      GROUP BY t.topic_id, u.unit_name, m.subject_name, a1.full_name
    `;

    try {
      const [result] = await client.execute(query, [topicId]);
      if (result.length === 0) return null;
      const topic = result[0];
      return {
        ...this.formatTopic(topic),
        questions_count: parseInt(topic.questions_count) || 0,
        flashcards_count: parseInt(topic.flashcards_count) || 0,
        library_files_count: parseInt(topic.library_files_count) || 0
      };
    } catch (error) {
      throw new Error(`Error fetching topic: ${error.message}`);
    }
  }

  // عدد الموضوعات الإجمالي (للتصفح)
  async getTopicsCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT t.topic_id) as total
      FROM topics t
      LEFT JOIN units u ON t.unit_id = u.unit_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.status) {
      query += ` AND t.status = ?`;
      values.push(filters.status);
    }
    if (filters.unit_id) {
      query += ` AND t.unit_id = ?`;
      values.push(filters.unit_id);
    }
    if (filters.search) {
      query += ` AND (t.topic_name LIKE ? OR t.short_description LIKE ? OR t.learning_objectives LIKE ?)`;
      values.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags
        .map(() => `JSON_CONTAINS(t.tags, JSON_QUOTE(?))`)
        .join(" AND ");
      query += ` AND (${tagConditions})`;
      values.push(...filters.tags);
    }

    try {
      const [result] = await client.execute(query, values);
      return parseInt(result[0].total) || 0;
    } catch (error) {
      throw new Error(`Error counting topics: ${error.message}`);
    }
  }

  // تنسيق بيانات الموضوع
  formatTopic(topic) {
    if (!topic) return null;

    return {
      ...topic,
      tags: topic.tags ? JSON.parse(topic.tags) : []
    };
  }

  // تحديث موضوع
  async updateTopic(topicId, updates = {}, updatedBy = null) {
    const fieldMap = {
      topic_name: "topic_name",
      short_description: "short_description",
      learning_objectives: "learning_objectives",
      unit_id: "unit_id",
      status: "status",
      tags: "tags",
      topic_order: "topic_order"
    };

    const setParts = [];
    const values = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        if (key === "tags") {
          if (updates[key] === null) {
            setParts.push(`${column} = NULL`);
          } else {
            setParts.push(`${column} = ?`);
            values.push(JSON.stringify(updates[key]));
          }
        } else {
          setParts.push(`${column} = ?`);
          values.push(updates[key]);
        }
      }
    }

    // سجل مَن قام بالتحديث
    setParts.push(`updated_by = ?`);
    values.push(updatedBy);

    // حدّث وقت التعديل
    setParts.push(`updated_at = CURRENT_TIMESTAMP`);

    if (setParts.length === 0) {
      throw new Error("No valid fields to update");
    }

    const sql = `UPDATE topics SET ${setParts.join(", ")} WHERE topic_id = ?`;
    values.push(topicId);

    try {
      const [result] = await client.execute(sql, values);
      if (!result.affectedRows) return null;

      // ارجع الموضوع بعد التحديث بالتفاصيل الكاملة
      return await this.getTopicById(topicId);
    } catch (error) {
      throw new Error(`Error updating topic: ${error.message}`);
    }
  }

  async deleteTopic(topicId) {
    const sql = `DELETE FROM topics WHERE topic_id = ?`;

    try {
      const [result] = await client.execute(sql, [topicId]);
      if (!result.affectedRows) return null;

      // ارجع الموضوع بعد التحديث بالتفاصيل الكاملة
      return "Deleted";
    } catch (error) {
      throw new Error(`Error updating topic: ${error.message}`);
    }
  }

  async duplicateTopic(topicData) {
    const { id, unit_id, topic_name } = topicData;
    console.log(topicData);
    const oldTopic = await this.getTopicById(id);
    const query = `
    INSERT INTO topics (
      unit_id, topic_name, short_description, learning_objectives, topic_order, status, tags, created_by
    )
    SELECT 
      ?, ?, short_description, learning_objectives, topic_order, status, tags, created_by
    FROM topics
    WHERE topic_id = ?
  `;
    try {
      const [result] = await client.execute(query, [
        unit_id || 0,
        topic_name || oldTopic.topic_name,
        id || 0
      ]);
      const [newTopic] = await client.execute(
        "SELECT * FROM topics WHERE topic_id = LAST_INSERT_ID()"
      );
      const [questions] = await client.execute(
        `SELECT questions.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
          'option_id', question_options.option_id, 
          'option_text', question_options.option_text, 
          'is_correct', question_options.is_correct, 
          'explanation', question_options.explanation
          )
        ) As answers
        FROM questions 
        LEFT JOIN question_options ON question_options.question_id = questions.question_id  
        WHERE questions.topic_id = ? GROUP BY questions.question_id`,
        [id]
      );
      questions.map((item) => {
        item.answers = JSON.parse(item.answers);
        console.log(item.answers?.length);
        return item;
      });
      // get flashcards
      const [flashcards] = await client.execute(
        `SELECT * FROM flashcards WHERE topic_id = ?`,
        [id]
      );
      // get library files
      const [libraryFiles] = await client.execute(
        `SELECT * FROM digital_library WHERE topic_id = ?`,
        [id]
      );
      // insert questions

      for (const question of questions) {
        const insertQuestionQuery = `
          INSERT INTO questions (topic_id, question_text, question_type, model_answer, difficulty_level, hint, keywords, tags, help_guidance, points, status, usage_count, acceptance_rate, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [insertResult] = await client.execute(insertQuestionQuery, [
          newTopic[0].topic_id || null,
          question.question_text || "",
          question.question_type || "",
          question.model_answer || "",
          question.difficulty_level || "",
          question.hint || "",
          question.keywords || "",
          question.tags || "",
          question.help_guidance || "",
          question.points || 0,
          question.status || "active",
          question.usage_count || 0,
          question.acceptance_rate || 0,
          question.created_by || 1,
          question.updated_by || 1
        ]);
        const newQuestionId = insertResult.insertId;
        // insert question options

        for (const option of question.answers) {
          const insertOptionQuery = `
            INSERT INTO question_options (question_id, option_text, is_correct, explanation, video_explanation_url, option_order)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          await client.execute(insertOptionQuery, [
            newQuestionId,
            option.option_text || "",
            option.is_correct || 0,
            option.explanation || "",
            option.video_explanation_url || null,
            option.option_order || 1
          ]);
        }
      }
      // insert flashcards

      for (const flashcard of flashcards) {
        const insertFlashcardQuery = `
          INSERT INTO flashcards (library_id, topic_id, front_text, back_text, difficulty_level, card_order, status, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await client.execute(insertFlashcardQuery, [
          flashcard.library_id || null,
          newTopic[0].topic_id || null,
          flashcard.front_text || "",
          flashcard.back_text || "",
          flashcard.difficulty_level || "",
          flashcard.card_order || 1,
          flashcard.status || "active",
          flashcard.created_by || 1,
          flashcard.updated_by || 1
        ]);
      }
      // insert library files

      for (const file of libraryFiles) {
        const insertFileQuery = `
          INSERT INTO digital_library (topic_id, book_title, description, file_name, original_name, file_path, file_type, file_size, pages_count, processing_status, approval_status, view_count, download_count, status, uploaded_by, approved_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await client.execute(insertFileQuery, [
          newTopic[0].topic_id || null,
          file.book_title || "",
          file.description || "",
          file.file_name || "",
          file.original_name || "",
          file.file_path || "",
          file.file_type || "",
          file.file_size || 0,
          file.pages_count || 0,
          file.processing_status || "pending",
          file.approval_status || "pending",
          file.view_count || 0,
          file.download_count || 0,
          file.status || "active",
          file.uploaded_by || 1,
          file.approved_by || 1
        ]);
      }
      //

      console.log("result", questions);
      return this.formatTopic(newTopic[0]);
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = new TopicsRepository();
