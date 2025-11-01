const { client } = require("../../config/db-connect");

class FlashcardsRepository {
  // جلب جميع البطاقات التعليمية مع فلاتر
  async getAllFlashcards(filters = {}) {
    let query = `
      SELECT
        f.*,
        fl.library_name,
        fl.description as library_description,
        t.topic_name,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name
      FROM flashcards f
      LEFT JOIN flashcard_libraries fl ON f.library_id = fl.library_id
      LEFT JOIN topics t ON f.topic_id = t.topic_id
      LEFT JOIN admins a1 ON f.created_by = a1.admin_id
      LEFT JOIN admins a2 ON f.updated_by = a2.admin_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND f.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.library_id) {
      query += ` AND f.library_id = ?`;
      values.push(filters.library_id);
    }
    if (filters.difficulty_level) {
      query += ` AND f.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.status) {
      query += ` AND f.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (f.front_text LIKE ? OR f.back_text LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY f.card_order ASC, f.created_at DESC`;

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
      return result.map((row) => this.formatFlashcard(row));
    } catch (error) {
      throw new Error(`Error fetching flashcards: ${error.message}`);
    }
  }

  // بطاقات موضوع معين
  async getFlashcardsByTopicId(topicId, filters = {}) {
    try {
      const allFilters = {
        ...filters,
        topic_id: topicId,
      };
      return await this.getAllFlashcards(allFilters);
    } catch (error) {
      throw new Error(`Error fetching flashcards for topic: ${error.message}`);
    }
  }

  // بطاقات مكتبة معينة
  async getFlashcardsByLibraryId(libraryId, filters = {}) {
    try {
      const allFilters = {
        ...filters,
        library_id: libraryId,
      };
      return await this.getAllFlashcards(allFilters);
    } catch (error) {
      throw new Error(`Error fetching flashcards for library: ${error.message}`);
    }
  }

  // عدد البطاقات التعليمية الإجمالي
  async getFlashcardsCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT f.flashcard_id) as total
      FROM flashcards f
      LEFT JOIN flashcard_libraries fl ON f.library_id = fl.library_id
      LEFT JOIN topics t ON f.topic_id = t.topic_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND f.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.library_id) {
      query += ` AND f.library_id = ?`;
      values.push(filters.library_id);
    }
    if (filters.difficulty_level) {
      query += ` AND f.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.status) {
      query += ` AND f.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (f.front_text LIKE ? OR f.back_text LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    try {
      const [result] = await client.execute(query, values);
      return parseInt(result[0].total) || 0;
    } catch (error) {
      throw new Error(`Error counting flashcards: ${error.message}`);
    }
  }

  // بطاقة تعليمية بواسطة ID
  async getFlashcardById(flashcardId) {
    const query = `
      SELECT
        f.*,
        fl.library_name,
        fl.description as library_description,
        t.topic_name,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name
      FROM flashcards f
      LEFT JOIN flashcard_libraries fl ON f.library_id = fl.library_id
      LEFT JOIN topics t ON f.topic_id = t.topic_id
      LEFT JOIN admins a1 ON f.created_by = a1.admin_id
      LEFT JOIN admins a2 ON f.updated_by = a2.admin_id
      WHERE f.flashcard_id = ?
    `;

    try {
      const [result] = await client.execute(query, [flashcardId]);
      return result.length > 0 ? this.formatFlashcard(result[0]) : null;
    } catch (error) {
      throw new Error(`Error fetching flashcard: ${error.message}`);
    }
  }

  // إنشاء بطاقة تعليمية جديدة
  async createFlashcard(flashcardData, createdBy = null) {
    const query = `
      INSERT INTO flashcards (
        library_id, topic_id, front_text, back_text, difficulty_level,
        card_order, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      flashcardData.library_id,
      flashcardData.topic_id || null,
      flashcardData.front_text,
      flashcardData.back_text,
      flashcardData.difficulty_level || "medium",
      flashcardData.card_order || 1,
      flashcardData.status || "draft",
      createdBy,
    ];

    try {
      const [result] = await client.execute(query, values);
      return await this.getFlashcardById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating flashcard: ${error.message}`);
    }
  }

  // تحديث بطاقة تعليمية
  async updateFlashcard(flashcardId, flashcardData, updatedBy = null) {
    const updateFields = [];
    const values = [];

    if (flashcardData.library_id !== undefined) {
      updateFields.push("library_id = ?");
      values.push(flashcardData.library_id);
    }
    if (flashcardData.topic_id !== undefined) {
      updateFields.push("topic_id = ?");
      values.push(flashcardData.topic_id);
    }
    if (flashcardData.front_text !== undefined) {
      updateFields.push("front_text = ?");
      values.push(flashcardData.front_text);
    }
    if (flashcardData.back_text !== undefined) {
      updateFields.push("back_text = ?");
      values.push(flashcardData.back_text);
    }
    if (flashcardData.difficulty_level !== undefined) {
      updateFields.push("difficulty_level = ?");
      values.push(flashcardData.difficulty_level);
    }
    if (flashcardData.card_order !== undefined) {
      updateFields.push("card_order = ?");
      values.push(flashcardData.card_order);
    }
    if (flashcardData.status !== undefined) {
      updateFields.push("status = ?");
      values.push(flashcardData.status);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push("updated_by = ?", "updated_at = NOW()");
    values.push(updatedBy, flashcardId);

    const query = `UPDATE flashcards SET ${updateFields.join(", ")} WHERE flashcard_id = ?`;

    try {
      await client.execute(query, values);
      return await this.getFlashcardById(flashcardId);
    } catch (error) {
      throw new Error(`Error updating flashcard: ${error.message}`);
    }
  }

  // حذف بطاقة تعليمية
  async deleteFlashcard(flashcardId) {
    const query = `DELETE FROM flashcards WHERE flashcard_id = ?`;

    try {
      const [result] = await client.execute(query, [flashcardId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting flashcard: ${error.message}`);
    }
  }

  // إحصائيات البطاقات التعليمية
  async getFlashcardsStats() {
    const query = `
      SELECT
        COUNT(*) as total_flashcards,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_flashcards,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_flashcards,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_flashcards,
        COUNT(CASE WHEN difficulty_level = 'easy' THEN 1 END) as easy_flashcards,
        COUNT(CASE WHEN difficulty_level = 'medium' THEN 1 END) as medium_flashcards,
        COUNT(CASE WHEN difficulty_level = 'hard' THEN 1 END) as hard_flashcards,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as created_this_week
      FROM flashcards
    `;

    try {
      const [result] = await client.execute(query);
      return result[0] || {};
    } catch (error) {
      throw new Error(`Error fetching flashcards stats: ${error.message}`);
    }
  }

  // إنشاء بطاقات تعليمية من ملف مع معالجة مجمعة محسنة
  async createFlashcardsFromFile(flashcardsData, createdBy = null) {
    try {
      console.log(`Starting to create ${flashcardsData.length} flashcards`);

      // Test database connection
      try {
        const [testResult] = await client.execute("SELECT 1 as test");
        console.log("Database connection test successful:", testResult);
      } catch (dbError) {
        console.error("Database connection test failed:", dbError.message);
        throw new Error(`Database connection failed: ${dbError.message}`);
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: flashcardsData.length,
        successCount: 0,
        failureCount: 0
      };

      // استخدام المعاملات لتحسين الأداء
      console.log("Starting transaction...");
      await client.execute("START TRANSACTION");

      try {
        // معالجة البطاقات في مجموعات لتحسين الأداء
        const batchSize = 50; // معالجة 50 بطاقة في كل مرة
        const batches = [];

        for (let i = 0; i < flashcardsData.length; i += batchSize) {
          batches.push(flashcardsData.slice(i, i + batchSize));
        }

        console.log(`Processing ${batches.length} batches`);

        // معالجة كل مجموعة بالتسلسل لتجنب مشاكل القفل في قاعدة البيانات
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} flashcards`);

          // Process flashcards in batch sequentially to avoid database locks
          for (let index = 0; index < batch.length; index++) {
            const flashcardData = batch[index];
            const globalIndex = batchIndex * batchSize + index + 1;
            
            try {
              console.log(`Creating flashcard ${globalIndex}/${flashcardsData.length}: ${flashcardData.front_text?.substring(0, 50)}...`);
              const flashcard = await this.createFlashcardInBatch(flashcardData, createdBy);
              console.log(`Successfully created flashcard ${globalIndex} with ID: ${flashcard.flashcard_id}`);
              
              results.successful.push({
                index: globalIndex,
                flashcard_id: flashcard.flashcard_id,
                front_text: flashcard.front_text,
                back_text: flashcard.back_text
              });
              results.successCount++;
            } catch (error) {
              console.error(`Failed to create flashcard ${globalIndex}:`, error.message);
              results.failed.push({
                index: globalIndex,
                flashcard_data: flashcardData,
                error: error.message
              });
              results.failureCount++;
              // Continue processing even if one fails
            }
          }
          
          console.log(`Batch ${batchIndex + 1} completed: ${results.successCount} successful, ${results.failureCount} failed so far`);
        }

        console.log("Committing transaction...");
        await client.execute("COMMIT");
        console.log(`Transaction committed successfully. Created ${results.successCount} flashcards`);
        return results;

      } catch (error) {
        console.error("Critical error in transaction, rolling back:", error.message);
        console.error("Error stack:", error.stack);
        try {
          await client.execute("ROLLBACK");
        } catch (rollbackError) {
          console.error("Error during rollback:", rollbackError.message);
        }
        // Don't throw - return partial results instead
        console.log(`Transaction rolled back. Returning partial results: ${results.successCount} successful, ${results.failureCount} failed`);
        return results;
      }

    } catch (error) {
      console.error("Error creating flashcards from file:", error.message);
      throw new Error(`Error creating flashcards from file: ${error.message}`);
    }
  }

  // إنشاء بطاقة تعليمية واحدة داخل المعاملة
  async createFlashcardInBatch(flashcardData, createdBy = null) {
    const {
      library_id,
      topic_id,
      front_text,
      back_text,
      difficulty_level = "medium",
      card_order = 1,
      status = "draft"
    } = flashcardData;

    // إنشاء البطاقة التعليمية - استخدام نفس الأعمدة الموجودة في createFlashcard
    const flashcardQuery = `
      INSERT INTO flashcards (
        library_id, topic_id, front_text, back_text, difficulty_level,
        card_order, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const flashcardValues = [
      library_id,
      topic_id || null,
      front_text,
      back_text,
      difficulty_level,
      card_order,
      status,
      createdBy
    ];

    console.log("Executing flashcard insert query...");
    const [flashcardResult] = await client.execute(flashcardQuery, flashcardValues);
    const flashcardId = flashcardResult.insertId;
    console.log(`Flashcard inserted with ID: ${flashcardId}`);

    return {
      flashcard_id: flashcardId,
      front_text,
      back_text,
      library_id,
      topic_id,
      difficulty_level,
      status
    };
  }

  // تنسيق بيانات البطاقة التعليمية
  formatFlashcard(flashcard) {
    if (!flashcard) return null;

    return {
      ...flashcard,
      // تحويل التواريخ إلى ISO string إذا لزم الأمر
      created_at: flashcard.created_at instanceof Date 
        ? flashcard.created_at.toISOString() 
        : flashcard.created_at,
      updated_at: flashcard.updated_at instanceof Date 
        ? flashcard.updated_at.toISOString() 
        : flashcard.updated_at,
    };
  }
}

module.exports = new FlashcardsRepository();
