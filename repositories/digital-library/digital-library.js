const { client } = require("../../config/db-connect");

class DigitalLibraryRepository {
  // جلب جميع الملفات مع فلاتر
  async getAllLibraryFiles(filters = {}) {
    let query = `
      SELECT
        dl.*,
        t.topic_name,
        a1.admin_name as uploaded_by_name,
        a2.admin_name as approved_by_name
      FROM digital_library dl
      LEFT JOIN topics t ON dl.topic_id = t.topic_id
      LEFT JOIN admins a1 ON dl.uploaded_by = a1.admin_id
      LEFT JOIN admins a2 ON dl.approved_by = a2.admin_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND dl.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.file_type) {
      query += ` AND dl.file_type = ?`;
      values.push(filters.file_type);
    }
    if (filters.processing_status) {
      query += ` AND dl.processing_status = ?`;
      values.push(filters.processing_status);
    }
    if (filters.approval_status) {
      query += ` AND dl.approval_status = ?`;
      values.push(filters.approval_status);
    }
    if (filters.search) {
      query += ` AND (dl.book_title LIKE ? OR dl.description LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY dl.created_at DESC`;

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
      return result.map((row) => this.formatLibraryFile(row));
    } catch (error) {
      throw new Error(`Error fetching library files: ${error.message}`);
    }
  }

  // ملفات موضوع معين
  async getLibraryFilesByTopicId(topicId, filters = {}) {
    try {
      const allFilters = {
        ...filters,
        topic_id: topicId,
      };
      return await this.getAllLibraryFiles(allFilters);
    } catch (error) {
      throw new Error(
        `Error fetching library files for topic: ${error.message}`
      );
    }
  }

  // عدد الملفات الإجمالي
  async getLibraryFilesCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT dl.library_id) as total
      FROM digital_library dl
      LEFT JOIN topics t ON dl.topic_id = t.topic_id
      WHERE 1=1
    `;

    const values = [];

    if (filters.topic_id) {
      query += ` AND dl.topic_id = ?`;
      values.push(filters.topic_id);
    }
    if (filters.file_type) {
      query += ` AND dl.file_type = ?`;
      values.push(filters.file_type);
    }
    if (filters.processing_status) {
      query += ` AND dl.processing_status = ?`;
      values.push(filters.processing_status);
    }
    if (filters.approval_status) {
      query += ` AND dl.approval_status = ?`;
      values.push(filters.approval_status);
    }
    if (filters.search) {
      query += ` AND (dl.book_title LIKE ? OR dl.description LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    try {
      const [result] = await client.execute(query, values);
      return parseInt(result[0].total) || 0;
    } catch (error) {
      throw new Error(`Error counting library files: ${error.message}`);
    }
  }

  // ملف بواسطة ID
  async getLibraryFileById(libraryId) {
    const query = `
      SELECT
        dl.*,
        t.topic_name,
        a1.admin_name as uploaded_by_name,
        a2.admin_name as approved_by_name
      FROM digital_library dl
      LEFT JOIN topics t ON dl.topic_id = t.topic_id
      LEFT JOIN admins a1 ON dl.uploaded_by = a1.admin_id
      LEFT JOIN admins a2 ON dl.approved_by = a2.admin_id
      WHERE dl.library_id = ?
    `;

    try {
      const [result] = await client.execute(query, [libraryId]);
      return result.length > 0 ? this.formatLibraryFile(result[0]) : null;
    } catch (error) {
      throw new Error(`Error fetching library file: ${error.message}`);
    }
  }

  // إنشاء ملف جديد
  async createLibraryFile(fileData, createdBy = null) {
    const query = `
      INSERT INTO digital_library (
        topic_id, book_title, description, file_name, original_name,
        file_path, file_type, file_size, pages_count, processing_status,
        approval_status, view_count, download_count, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      fileData.topic_id || null,
      fileData.book_title,
      fileData.description,
      fileData.file_name,
      fileData.original_name,
      fileData.file_path,
      fileData.file_type,
      fileData.file_size,
      fileData.pages_count || null,
      fileData.processing_status || "pending",
      fileData.approval_status || "pending",
      fileData.view_count || 0,
      fileData.download_count || 0,
      createdBy,
    ];

    try {
      const [result] = await client.execute(query, values);
      return await this.getLibraryFileById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating library file: ${error.message}`);
    }
  }

  // تحديث ملف
  async updateLibraryFile(libraryId, fileData, updatedBy = null) {
    const updateFields = [];
    const values = [];

    if (fileData.topic_id !== undefined) {
      updateFields.push("topic_id = ?");
      values.push(fileData.topic_id);
    }
    if (fileData.book_title !== undefined) {
      updateFields.push("book_title = ?");
      values.push(fileData.book_title);
    }
    if (fileData.description !== undefined) {
      updateFields.push("description = ?");
      values.push(fileData.description);
    }
    if (fileData.pages_count !== undefined) {
      updateFields.push("pages_count = ?");
      values.push(fileData.pages_count);
    }
    if (fileData.processing_status !== undefined) {
      updateFields.push("processing_status = ?");
      values.push(fileData.processing_status);
    }
    if (fileData.approval_status !== undefined) {
      updateFields.push("approval_status = ?");
      values.push(fileData.approval_status);
    }
    if (fileData.approved_by !== undefined) {
      updateFields.push("approved_by = ?");
      values.push(fileData.approved_by);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push("updated_at = NOW()");
    values.push(libraryId);

    const query = `UPDATE digital_library SET ${updateFields.join(
      ", "
    )} WHERE library_id = ?`;

    try {
      await client.execute(query, values);
      return await this.getLibraryFileById(libraryId);
    } catch (error) {
      throw new Error(`Error updating library file: ${error.message}`);
    }
  }

  // زيادة عدد المشاهدات
  async incrementViewCount(libraryId) {
    const query = `UPDATE digital_library SET view_count = view_count + 1 WHERE library_id = ?`;

    try {
      await client.execute(query, [libraryId]);
      return true;
    } catch (error) {
      throw new Error(`Error incrementing view count: ${error.message}`);
    }
  }

  // زيادة عدد التحميلات
  async incrementDownloadCount(libraryId) {
    const query = `UPDATE digital_library SET download_count = download_count + 1 WHERE library_id = ?`;

    try {
      await client.execute(query, [libraryId]);
      const file = await this.getLibraryFileById(libraryId);
      return file;
    } catch (error) {
      throw new Error(`Error incrementing download count: ${error.message}`);
    }
  }

  // زيادة عدد المشاهدات (مع إرجاع البيانات المحدثة)
  async incrementViewCount(libraryId) {
    const query = `UPDATE digital_library SET view_count = view_count + 1 WHERE library_id = ?`;

    try {
      await client.execute(query, [libraryId]);
      const file = await this.getLibraryFileById(libraryId);
      return file;
    } catch (error) {
      throw new Error(`Error incrementing view count: ${error.message}`);
    }
  }

  // أشهر الكتب (الأكثر مشاهدة)
  async getMostViewedBooks(limit = 10) {
    const query = `
      SELECT
        dl.*,
        t.topic_name,
        a1.admin_name as uploaded_by_name,
        a2.admin_name as approved_by_name
      FROM digital_library dl
      LEFT JOIN topics t ON dl.topic_id = t.topic_id
      LEFT JOIN admins a1 ON dl.uploaded_by = a1.admin_id
      LEFT JOIN admins a2 ON dl.approved_by = a2.admin_id
      WHERE dl.approval_status = 'approved'
      ORDER BY dl.view_count DESC
      LIMIT ?
    `;

    try {
      const [result] = await client.execute(query, [limit]);
      return result.map((row) => this.formatLibraryFile(row));
    } catch (error) {
      throw new Error(`Error fetching most viewed books: ${error.message}`);
    }
  }

  // أحدث الكتب
  async getRecentBooks(limit = 10) {
    const query = `
      SELECT
        dl.*,
        t.topic_name,
        a1.admin_name as uploaded_by_name,
        a2.admin_name as approved_by_name
      FROM digital_library dl
      LEFT JOIN topics t ON dl.topic_id = t.topic_id
      LEFT JOIN admins a1 ON dl.uploaded_by = a1.admin_id
      LEFT JOIN admins a2 ON dl.approved_by = a2.admin_id
      WHERE dl.approval_status = 'approved'
      ORDER BY dl.created_at DESC
      LIMIT ?
    `;

    try {
      const [result] = await client.execute(query, [limit]);
      return result.map((row) => this.formatLibraryFile(row));
    } catch (error) {
      throw new Error(`Error fetching recent books: ${error.message}`);
    }
  }

  // حذف ملف
  async deleteLibraryFile(libraryId) {
    const query = `DELETE FROM digital_library WHERE library_id = ?`;

    try {
      const [result] = await client.execute(query, [libraryId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting library file: ${error.message}`);
    }
  }

  // إحصائيات المكتبة الرقمية
  async getDigitalLibraryStats() {
    const query = `
      SELECT
        COUNT(*) as total_files,
        COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_files,
        COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_files,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_files,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_files,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_approval,
        SUM(file_size) as total_size,
        SUM(view_count) as total_views,
        SUM(download_count) as total_downloads,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as created_this_week
      FROM digital_library
    `;

    try {
      const [result] = await client.execute(query);
      return result[0] || {};
    } catch (error) {
      throw new Error(`Error fetching library stats: ${error.message}`);
    }
  }

  // إحصائيات المكتبة الرقمية (للتوافق مع الطريقة القديمة)
  async getLibraryStats() {
    const query = `
      SELECT
        COUNT(*) as total_files,
        COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_files,
        COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_files,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_files,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_files,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_approval,
        SUM(file_size) as total_size,
        SUM(view_count) as total_views,
        SUM(download_count) as total_downloads,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as created_this_week
      FROM digital_library
    `;

    try {
      const [result] = await client.execute(query);
      return result[0] || {};
    } catch (error) {
      throw new Error(`Error fetching library stats: ${error.message}`);
    }
  }

  // تنسيق بيانات الملف
  formatLibraryFile(file) {
    if (!file) return null;

    return {
      ...file,
      // تحويل حجم الملف إلى تنسيق قابل للقراءة
      file_size_formatted: this.formatFileSize(file.file_size),
      // تحويل التواريخ إلى ISO string إذا لزم الأمر
      created_at:
        file.created_at instanceof Date
          ? file.created_at.toISOString()
          : file.created_at,
      updated_at:
        file.updated_at instanceof Date
          ? file.updated_at.toISOString()
          : file.updated_at,
    };
  }

  // تنسيق حجم الملف
  formatFileSize(bytes) {
    if (!bytes) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

module.exports = new DigitalLibraryRepository();
