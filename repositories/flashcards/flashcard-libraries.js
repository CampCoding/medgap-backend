const { client } = require("../../config/db-connect");

class FlashcardLibrariesRepository {
  // جلب جميع مكتبات البطاقات التعليمية مع فلاتر
  async getAllFlashcardLibraries(filters = {}) {
    let query = `
      SELECT
        fl.*,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name,
        COUNT(DISTINCT f.flashcard_id) as cards_count
      FROM flashcard_libraries fl
      LEFT JOIN admins a1 ON fl.created_by = a1.admin_id
      LEFT JOIN admins a2 ON fl.updated_by = a2.admin_id
      LEFT JOIN flashcards f ON fl.library_id = f.library_id
      WHERE 1=1
    `;

    const values = [];
if (filters.difficulty_level) {
      query += ` AND fl.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.topic_id) {
      query += ` AND fl.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.status) {
      query += ` AND fl.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (fl.library_name LIKE ? OR fl.description LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` GROUP BY fl.library_id, a1.admin_name, a2.admin_name`;
    query += ` ORDER BY fl.created_at DESC`;

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
      return result.map((row) => this.formatFlashcardLibrary(row));
    } catch (error) {
      throw new Error(`Error fetching flashcard libraries: ${error.message}`);
    }
  }

  // عدد مكتبات البطاقات التعليمية الإجمالي
  async getFlashcardLibrariesCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT fl.library_id) as total
      FROM flashcard_libraries fl
      WHERE 1=1
    `;

    const values = [];

    if (filters.difficulty_level) {
      query += ` AND fl.difficulty_level = ?`;
      values.push(filters.difficulty_level);
    }
    if (filters.status) {
      query += ` AND fl.status = ?`;
      values.push(filters.status);
    }
    if (filters.search) {
      query += ` AND (fl.library_name LIKE ? OR fl.description LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    try {
      const [result] = await client.execute(query, values);
      return parseInt(result[0].total) || 0;
    } catch (error) {
      throw new Error(`Error counting flashcard libraries: ${error.message}`);
    }
  }

  // مكتبة بطاقات بواسطة ID
  async getFlashcardLibraryById(libraryId) {
    const query = `
      SELECT
        fl.*,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name,
        COUNT(DISTINCT f.flashcard_id) as cards_count
      FROM flashcard_libraries fl
      LEFT JOIN admins a1 ON fl.created_by = a1.admin_id
      LEFT JOIN admins a2 ON fl.updated_by = a2.admin_id
      LEFT JOIN flashcards f ON fl.library_id = f.library_id
      WHERE fl.library_id = ?
      GROUP BY fl.library_id, a1.admin_name, a2.admin_name
    `;

    try {
      const [result] = await client.execute(query, [libraryId]);
      return result.length > 0 ? this.formatFlashcardLibrary(result[0]) : null;
    } catch (error) {
      throw new Error(`Error fetching flashcard library: ${error.message}`);
    }
  }

  // إنشاء مكتبة بطاقات جديدة
  async createFlashcardLibrary(libraryData, createdBy = null) {
    const query = `
      INSERT INTO flashcard_libraries (
        library_name, description, difficulty_level, estimated_time,
        status, created_by, topic_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      libraryData.library_name,
      libraryData.description,
      libraryData.difficulty_level || "medium",
      libraryData.estimated_time || null,
      libraryData.status || "draft",
      createdBy,
      libraryData?.topic_id
    ];

    try {
      const [result] = await client.execute(query, values);
      return await this.getFlashcardLibraryById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating flashcard library: ${error.message}`);
    }
  }

  // تحديث مكتبة بطاقات
  async updateFlashcardLibrary(libraryId, libraryData, updatedBy = null) {
    const updateFields = [];
    const values = [];

    if (libraryData.library_name !== undefined) {
      updateFields.push("library_name = ?");
      values.push(libraryData.library_name);
    }
    if (libraryData.description !== undefined) {
      updateFields.push("description = ?");
      values.push(libraryData.description);
    }
    if (libraryData.difficulty_level !== undefined) {
      updateFields.push("difficulty_level = ?");
      values.push(libraryData.difficulty_level);
    }
    if (libraryData.estimated_time !== undefined) {
      updateFields.push("estimated_time = ?");
      values.push(libraryData.estimated_time);
    }
    if (libraryData.status !== undefined) {
      updateFields.push("status = ?");
      values.push(libraryData.status);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push("updated_by = ?", "updated_at = NOW()");
    values.push(updatedBy, libraryId);

    const query = `UPDATE flashcard_libraries SET ${updateFields.join(
      ", "
    )} WHERE library_id = ?`;

    try {
      await client.execute(query, values);
      return await this.getFlashcardLibraryById(libraryId);
    } catch (error) {
      throw new Error(`Error updating flashcard library: ${error.message}`);
    }
  }

  // حذف مكتبة بطاقات
  async deleteFlashcardLibrary(libraryId) {
    const query = `DELETE FROM flashcard_libraries WHERE library_id = ?`;

    try {
      const [result] = await client.execute(query, [libraryId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting flashcard library: ${error.message}`);
    }
  }

  // إحصائيات مكتبات البطاقات التعليمية
  async getFlashcardLibrariesStats() {
    const query = `
      SELECT
        COUNT(DISTINCT fl.library_id) as total_libraries,
        COUNT(DISTINCT f.flashcard_id) as total_cards,
        AVG(fl.estimated_time) as avg_estimated_time,
        COUNT(CASE WHEN fl.status = 'active' THEN 1 END) as active_libraries,
        COUNT(CASE WHEN fl.status = 'inactive' THEN 1 END) as inactive_libraries,
        COUNT(CASE WHEN fl.status = 'draft' THEN 1 END) as draft_libraries,
        COUNT(CASE WHEN fl.difficulty_level = 'easy' THEN 1 END) as easy_libraries,
        COUNT(CASE WHEN fl.difficulty_level = 'medium' THEN 1 END) as medium_libraries,
        COUNT(CASE WHEN fl.difficulty_level = 'hard' THEN 1 END) as hard_libraries,
        COUNT(CASE WHEN DATE(fl.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as created_this_week
      FROM flashcard_libraries fl
      LEFT JOIN flashcards f ON fl.library_id = f.library_id
    `;

    try {
      const [result] = await client.execute(query);
      const stats = result[0] || {};

      return {
        total_libraries: parseInt(stats.total_libraries) || 0,
        total_cards: parseInt(stats.total_cards) || 0,
        avg_estimated_time: parseFloat(stats.avg_estimated_time) || 0,
        active_libraries: parseInt(stats.active_libraries) || 0,
        inactive_libraries: parseInt(stats.inactive_libraries) || 0,
        draft_libraries: parseInt(stats.draft_libraries) || 0,
        easy_libraries: parseInt(stats.easy_libraries) || 0,
        medium_libraries: parseInt(stats.medium_libraries) || 0,
        hard_libraries: parseInt(stats.hard_libraries) || 0,
        created_this_week: parseInt(stats.created_this_week) || 0,
      };
    } catch (error) {
      throw new Error(
        `Error fetching flashcard libraries stats: ${error.message}`
      );
    }
  }

  // تنسيق بيانات مكتبة البطاقات التعليمية
  formatFlashcardLibrary(library) {
    if (!library) return null;

    return {
      ...library,
      cards_count: parseInt(library.cards_count) || 0,
      estimated_time: parseInt(library.estimated_time) || 0,
      // تحويل التواريخ إلى ISO string إذا لزم الأمر
      created_at:
        library.created_at instanceof Date
          ? library.created_at.toISOString()
          : library.created_at,
      updated_at:
        library.updated_at instanceof Date
          ? library.updated_at.toISOString()
          : library.updated_at,
    };
  }
}

module.exports = new FlashcardLibrariesRepository();
