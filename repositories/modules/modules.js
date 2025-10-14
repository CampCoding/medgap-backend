const { client } = require("../../config/db-connect");

class ModulesRepository {
  // إنشاء مادة جديدة
  async createModule(moduleData, createdBy = null) {
    const { subject_name, subject_code, description, status, subject_color } =
      moduleData;

    const query = `
      INSERT INTO modules (
        subject_name, subject_code, description, status, subject_color, created_by
      ) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      subject_name,
      subject_code,
      description || null,
      status || "active",
      subject_color || "#3498db",
      createdBy
    ];

    try {
      const [result] = await client.execute(query, values);
      //  السجل المُدرج
      const [newModule] = await client.execute(
        "SELECT * FROM modules WHERE module_id = LAST_INSERT_ID()"
      );
      return newModule[0];
    } catch (error) {
      throw new Error(`Error creating module: ${error.message}`);
    }
  }

  async createUnit(unitData, createdBy = null) {
    const { module_id, unit_name, unit_description, unit_order, status } =
      unitData;

    const query = `
    InsERT INTO units (
      module_id, unit_name, unit_description, unit_order, status, created_by
    ) 
    VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      module_id,
      unit_name,
      unit_description || null,
      unit_order || 1,
      status || "active",
      createdBy || 1
    ];

    try {
      const [result] = await client.execute(query, values);
      //  السجل المُدرج
      const [newUnit] = await client.execute(
        "SELECT * FROM units WHERE unit_id = LAST_INSERT_ID()"
      );
      return newUnit[0];
    } catch (error) {
      throw new Error(`Error creating module: ${error.message}`);
    }
  }

  async updateUnit(unitData, createdBy = null) {
    const { module_id, unit_name, unit_description, unit_order, status } =
      unitData;

    let query = ``;
    let values = [];
    if (module_id) {
      query += `UPDATE units SET module_id = ?`;
    }
    if (module_id) values.push(module_id);
    if (unit_name) {
      if (query) query += `, unit_name = ?`;
      else query += `UPDATE units SET unit_name = ?`;
      values.push(unit_name);
    }

    if (unit_description) {
      if (query) query += `, unit_description = ?`;
      else query += `UPDATE units SET unit_description = ?`;
      values.push(unit_description);
    }

    if (unit_order) {
      if (query) query += `, unit_order = ?`;
      else query += `UPDATE units SET unit_order = ?`;
      values.push(unit_order);
    }
    if (status) {
      if (query) query += `, status = ?`;
      else query += `UPDATE units SET status = ?`;
      values.push(status);
    }

    query += ` WHERE unit_id = ?`;
    values.push(unitData.unit_id);



    try {
      const [result] = await client.execute(query, values);
      //  السجل المُدرج
      const [newUnit] = await client.execute(
        "SELECT * FROM units WHERE unit_id = LAST_INSERT_ID()"
      );
      return newUnit[0];
    } catch (error) {
      throw new Error(`Error creating module: ${error.message}`);
    }
  }

  async deleteUnit(unitData, createdBy = null) {
    const { unit_id } = unitData;

    const query = `
    DELETE FROM units WHERE unit_id = ?
    `;

    const values = [unit_id || null];

    try {
      const [result] = await client.execute(query, values);
      return result.affectedRows > 0; // true if a row was deleted
    } catch (error) {
      throw new Error(`Error creating module: ${error.message}`);
    }
  }
  //  جميع المواد مع الإحصائيات
  async getAllModules(filters = {}) {
    let query = `
      SELECT 
        m.*,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name,
        COUNT(DISTINCT u.unit_id) as units_count,
        COUNT(DISTINCT se.student_id) as students_count,
        COUNT(DISTINCT q.question_id) as questions_count
      FROM modules m
      LEFT JOIN admins a1 ON m.created_by = a1.admin_id
      LEFT JOIN admins a2 ON m.updated_by = a2.admin_id
      LEFT JOIN units u ON m.module_id = u.module_id
      LEFT JOIN student_enrollments se ON m.module_id = se.module_id AND se.status = 'active'
      LEFT JOIN topics t ON u.unit_id = t.unit_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      WHERE 1=1
    `;

    const values = [];

    // فلترة حسب الحالة
    if (filters.status) {
      query += ` AND m.status = ?`;
      values.push(filters.status);
    }

    // البحث في اسم المادة أو الكود
    if (filters.search) {
      query += ` AND (m.subject_name LIKE ? OR m.subject_code LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` GROUP BY m.module_id, a1.admin_name, a2.admin_name`;
    query += ` ORDER BY m.created_at DESC`;

    // تحديد عدد النتائج
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
        ...row,
        units_count: parseInt(row.units_count) || 0,
        students_count: parseInt(row.students_count) || 0,
        questions_count: parseInt(row.questions_count) || 0
      }));
    } catch (error) {
      throw new Error(`Error fetching modules: ${error.message}`);
    }
  }

  //  مادة بواسطة ID مع التفاصيل الكاملة
  async getModuleById(moduleId) {
    const query = `
      SELECT 
        m.*,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name,
        COUNT(DISTINCT u.unit_id) as units_count,
        COUNT(DISTINCT se.student_id) as students_count,
        COUNT(DISTINCT q.question_id) as questions_count,
        COUNT(DISTINCT f.flashcard_id) as flashcards_count,
        COUNT(DISTINCT dl.library_id) as library_files_count
      FROM modules m
      LEFT JOIN admins a1 ON m.created_by = a1.admin_id
      LEFT JOIN admins a2 ON m.updated_by = a2.admin_id
      LEFT JOIN units u ON m.module_id = u.module_id
      LEFT JOIN student_enrollments se ON m.module_id = se.module_id AND se.status = 'active'
      LEFT JOIN topics t ON u.unit_id = t.unit_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      LEFT JOIN flashcards f ON t.topic_id = f.topic_id
      LEFT JOIN digital_library dl ON t.topic_id = dl.topic_id
      WHERE m.module_id = ?
      GROUP BY m.module_id, a1.admin_name, a2.admin_name
    `;

    try {
      const [result] = await client.execute(query, [moduleId]);
      if (result.length === 0) return null;

      const module = result[0];
      return {
        ...module,
        units_count: parseInt(module.units_count) || 0,
        students_count: parseInt(module.students_count) || 0,
        questions_count: parseInt(module.questions_count) || 0,
        flashcards_count: parseInt(module.flashcards_count) || 0,
        library_files_count: parseInt(module.library_files_count) || 0
      };
    } catch (error) {
      throw new Error(`Error fetching module: ${error.message}`);
    }
  }

  //  مادة بواسطة الكود
  async getModuleByCode(subjectCode) {
    const query = `SELECT * FROM modules WHERE subject_code = ?`;

    try {
      const [result] = await client.execute(query, [subjectCode]);
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error fetching module by code: ${error.message}`);
    }
  }

  // تحديث بيانات مادة
  async updateModule(moduleId, moduleData, updatedBy = null) {
    const allowedFields = [
      "subject_name",
      "subject_code",
      "description",
      "status",
      "subject_color"
    ];

    const updateFields = [];
    const values = [];

    // بناء الاستعلام ديناميكياً
    Object.keys(moduleData).forEach((key) => {
      if (allowedFields.includes(key) && moduleData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(moduleData[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    // إضافة updated_by
    if (updatedBy) {
      updateFields.push(`updated_by = ?`);
      values.push(updatedBy);
    }

    values.push(moduleId);

    const query = `
      UPDATE modules 
      SET ${updateFields.join(", ")}
      WHERE module_id = ?
    `;

    try {
      await client.execute(query, values);
      //  السجل المحدث
      const [result] = await client.execute(
        "SELECT * FROM modules WHERE module_id = ?",
        [moduleId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error updating module: ${error.message}`);
    }
  }

  // حذف مادة (soft delete)
  async deleteModule(moduleId, deletedBy = null) {
    const query = `
      UPDATE modules 
      SET status = 'inactive', updated_by = ?
      WHERE module_id = ?
    `;

    try {
      await client.execute(query, [deletedBy, moduleId]);
      const [result] = await client.execute(
        "SELECT * FROM modules WHERE module_id = ?",
        [moduleId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error deleting module: ${error.message}`);
    }
  }

  // حذف مادة نهائياً
  async permanentDeleteModule(moduleId) {
    const query = `DELETE FROM modules WHERE module_id = ?`;

    try {
      const [result] = await client.execute(query, [moduleId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error permanently deleting module: ${error.message}`);
    }
  }

  //  وحدات المادة
  async getModuleUnits(moduleId) {
    const query = `
      SELECT 
        u.*,
        COUNT(DISTINCT t.topic_id) as topics_count,
        COUNT(DISTINCT q.question_id) as questions_count
      FROM units u
      LEFT JOIN topics t ON u.unit_id = t.unit_id
      LEFT JOIN questions q ON t.topic_id = q.topic_id
      WHERE u.module_id = ?
      GROUP BY u.unit_id
      ORDER BY u.unit_order ASC, u.created_at ASC
    `;

    try {
      const [result] = await client.execute(query, [moduleId]);
      return result.map((row) => ({
        ...row,
        topics_count: parseInt(row.topics_count) || 0,
        questions_count: parseInt(row.questions_count) || 0
      }));
    } catch (error) {
      throw new Error(`Error fetching module units: ${error.message}`);
    }
  }

  //  المدرسين المرتبطين بالمادة
  async getModuleTeachers(moduleId) {
    const query = `
      SELECT 
        t.*,
        tm.assigned_at,
        tm.status as assignment_status
      FROM teachers t
      LEFT JOIN teacher_modules tm ON t.teacher_id = tm.teacher_id
      WHERE 1 = 1
      ORDER BY tm.assigned_at DESC
    `;

    try {
      const [result] = await client.execute(query);
      return result;
    } catch (error) {
      throw new Error(`Error fetching module teachers: ${error.message}`);
    }
  }

  //  الطلاب المسجلين في المادة
  async getModuleStudents() {
    let query = `
      SELECT 
        s.*,
        JSON_ARRAYAGG(
          IF(m.module_id IS NOT NULL,
            JSON_OBJECT(
              'module_id', m.module_id,
              'subject_name', m.subject_name,
              'subject_code', m.subject_code,
              'enrolled_at', se.enrolled_at,
              'enrollment_status', se.status,
              'grade', se.grade
            ),
            NULL
          )
        ) AS modules
      FROM students s
      LEFT JOIN student_enrollments se ON s.student_id = se.student_id
      LEFT JOIN modules m ON se.module_id = m.module_id
      GROUP BY s.student_id
      ORDER BY s.full_name
    `;

    try {
      const [result] = await client.execute(query);
      result?.forEach(item => {
        try {
          // Parse the modules JSON and filter out null values
          item.modules = JSON.parse(item?.modules || '[]')?.filter(module => module && module.module_id);
          
          // If modules is null or undefined, set it to an empty array
          if (!item.modules) {
            item.modules = [];
          }
        } catch (err) {
          item.modules = [];
        }
      });
      return result;
    } catch (error) {
      throw new Error(`Error fetching module students: ${error.message}`);
    }
  }

  // إحصائيات المواد
  async getModulesStats() {
    const query = `
      SELECT 
        COUNT(*) as total_modules,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_modules,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_modules,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_modules
      FROM modules
    `;

    try {
      const [result] = await client.execute(query);
      return result[0];
    } catch (error) {
      throw new Error(`Error fetching modules stats: ${error.message}`);
    }
  }

  //  المواد المتاحة للاختيار (للمدرسين)
  async getAvailableModules() {
    const query = `
      SELECT module_id, subject_name, subject_code, subject_color
      FROM modules 
      WHERE status = 'active'
      ORDER BY subject_name ASC
    `;

    try {
      const [result] = await client.execute(query);
      return result;
    } catch (error) {
      throw new Error(`Error fetching available modules: ${error.message}`);
    }
  }
}

module.exports = new ModulesRepository();
