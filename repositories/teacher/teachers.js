const { client } = require("../../config/db-connect");

class TeachersRepository {
  // إنشاء مدرس جديد
  async createTeacher(teacherData, moduleIds = [], createdBy = null) {
    const {
      full_name,
      email,
      phone,
      notes,
      experience_years,
      join_date,
      role,
      status,
      image_url,
      qualification,
      password,
      image_path,
      document_url
    } = teacherData;

    try {
      // بداية المعاملة
      await client.query("START TRANSACTION");

      // إنشاء المدرس
      const teacherQuery = `
        INSERT INTO teachers (
          full_name, email, phone, notes, experience_years, 
          join_date, role, status, image_url, qualification, created_by,
          password,document_url
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
      `;

      const teacherValues = [
        full_name,
        email,
        phone || null,
        notes || null,
        experience_years || 0,
        join_date || new Date(),
        role || "teacher",
        status || "pending",
        image_url || null,
        qualification || null,
        createdBy,
        password || null,
        document_url || null
      ];

      console.log("Executing query:", teacherQuery);
      console.log("With values:", teacherValues);

      const [teacherResult] = await client.execute(teacherQuery, teacherValues);
      //  المدرس الجديد
      const [newTeacherResult] = await client.execute(
        "SELECT * FROM teachers WHERE teacher_id = LAST_INSERT_ID()"
      );
      const newTeacher = newTeacherResult[0];

      // ربط المدرس بالمواد إذا تم تمرير مواد
      if (moduleIds && moduleIds.length > 0) {
        for (const moduleId of moduleIds) {
          const moduleAssignQuery = `
            INSERT INTO teacher_modules (teacher_id, module_id, assigned_by, status)
            VALUES (?, ?, ?, 'active')
          `;
          await client.execute(moduleAssignQuery, [
            newTeacher.teacher_id,
            moduleId,
            createdBy
          ]);
        }
      }

      // إنهاء المعاملة
      await client.query("COMMIT");

      return newTeacher;
    } catch (error) {
      // إلغاء المعاملة في حالة الخطأ
      await client.query("ROLLBACK");
      throw new Error(`Error creating teacher: ${error.message}`);
    }
  }

  //  جميع المدرسين مع فلترة اختيارية
  async getAllTeachers(filters = {}) {
    let query = `
      SELECT 
        t.*,  
        CONCAT('https://camp-coding.site/medgap/', t.image_url) as full_image_url,
       
        (SELECT COUNT(*) FROM teacher_modules tm WHERE tm.teacher_id = t.teacher_id) as active_modules_count,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('subject_name', m.subject_name, 'module_id', m.module_id)) FROM modules m
         LEFT JOIN teacher_modules tm ON m.module_id = tm.module_id
         WHERE tm.teacher_id = t.teacher_id) as active_modules
      FROM teachers t
      WHERE 1 = 1 
    `;

    const values = [];

    // // فلترة حسب الحالة
    // if (filters.status) {
    //   query += ` AND t.status = ?`;
    //   values.push(filters.status);
    // }

    // // فلترة حسب الدور
    if (filters.role) {
      query += ` AND t.role = ?`;
      values.push(filters.role);
    }else{
      query += ` AND t.role = 'teacher'`;
    }

    // // البحث في الاسم أو الإيميل
    if (filters.search) {
      query += ` AND (t.full_name LIKE ? OR t.email LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // ترتيب النتائج
    query += ` ORDER BY t.created_at DESC`;


    try {
      const [result] = await client.execute(query, values);
      console.log("result", result)
      result.map((row) => {
        try {
          row.active_modules_count = parseInt(row.active_modules_count) || 0;
          row.active_modules = row.active_modules
            ? JSON.parse(row.active_modules)
            : [];
        } catch {
          row.active_modules = [];
        }
        console.log
        return row;
      });
      return result;
    } catch (error) {
      throw new Error(`Error fetching teachers: ${error.message}`);
    }
  }

  async getTeachersStats() {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM teachers WHERE role = 'teacher') AS total,
        (SELECT COUNT(*) FROM teachers WHERE status = 'approved' AND role = 'teacher') AS approved,
        (SELECT COUNT(*) FROM teachers WHERE status = 'pending' AND role = 'teacher') AS pending,
        (SELECT COUNT(*) FROM teachers WHERE status = 'rejected' AND role = 'teacher') AS rejected,
        (SELECT COUNT(*) FROM teachers WHERE role = 'head_of_department' AND role = 'teacher') AS department_heads,
        (SELECT COUNT(*) FROM teachers WHERE role = 'assistant' AND role = 'teacher') AS teaching_assistants
    `;
    const [rows] = await client.execute(sql);

    return rows && rows[0] ? rows[0] : {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      department_heads: 0,
      teaching_assistants: 0,
    };
  }

  //  مدرس بواسطة ID
  async getTeacherById(teacherId) {
    const query = `
      SELECT 
        t.*,
        a1.admin_name as created_by_name,
        a2.admin_name as updated_by_name
      FROM teachers t
      LEFT JOIN admins a1 ON t.created_by = a1.admin_id
      LEFT JOIN admins a2 ON t.updated_by = a2.admin_id
      WHERE t.teacher_id = ?
    `;

    try {
      const [result] = await client.execute(query, [teacherId]);
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error fetching teacher: ${error.message}`);
    }
  }

  //  مدرس بواسطة الإيميل
  async getTeacherByEmail(email) {
    const query = `SELECT * FROM teachers WHERE email = ?`;

    try {
      const [result] = await client.execute(query, [email]);
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error fetching teacher by email: ${error.message}`);
    }
  }

  // inside TeachersRepository class — replace the existing updateTeacher method
  async updateTeacher(teacherId, teacherData, updatedBy = null) {
    console.log(teacherData)
    // define allowed fields exactly as in DB column names
    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "notes",
      "experience_years",
      "join_date",
      "role",
      "status",
      "image_url",
      "qualification",
      "password"
    ];

    const updateFields = [];
    const values = [];

    Object.keys(teacherData).forEach((key) => {
      if (allowedFields.includes(key) && teacherData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(teacherData[key]);
      }
    });

    if (updateFields.length === 0) {
      // nothing to update, just return current teacher
      const [row] = await client.execute(
        "SELECT * FROM teachers WHERE teacher_id = ?",
        [teacherId]
      );
      return row[0] || null;
    }

    // add updated_by and updated_at
    updateFields.push(`updated_by = ?`);
    values.push(updatedBy);
    updateFields.push(`updated_at = NOW()`); // sets timestamp on update (no placeholder)

    // teacherId as last parameter
    values.push(teacherId);

    const query = `
    UPDATE teachers
    SET ${updateFields.join(", ")}
    WHERE teacher_id = ?
  `;

    console.log("Executing query:", query);
    console.log("With values:", values);

    try {
      await client.execute(query, values);
      const [result] = await client.execute(
        "SELECT * FROM teachers WHERE teacher_id = ?",
        [teacherId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error updating teacher: ${error.message}`);
    }
  }

  // حذف مدرس (soft delete - تغيير الحالة إلى rejected)
  async deleteTeacher(teacherId, deletedBy = null) {
    const query = `
      UPDATE teachers 
      SET status = 'rejected', updated_by = ?
      WHERE teacher_id = ?
    `;

    try {
      await client.execute(query, [deletedBy, teacherId]);
      const [result] = await client.execute(
        "SELECT * FROM teachers WHERE teacher_id = ?",
        [teacherId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error deleting teacher: ${error.message}`);
    }
  }

  // حذف مدرس نهائياً (hard delete)
  async permanentDeleteTeacher(teacherId) {
    const query = `DELETE FROM teachers WHERE teacher_id = ?`;

    try {
      const [result] = await client.execute(query, [teacherId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error permanently deleting teacher: ${error.message}`);
    }
  }

  // تغيير حالة المدرس (approve/reject)
  async changeTeacherStatus(teacherId, status, changedBy = null) {
    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Invalid status");
    }

    const query = `
      UPDATE teachers 
      SET status = ?, updated_by = ?
      WHERE teacher_id = ?
    `;

    try {
      await client.execute(query, [status, changedBy, teacherId]);
      const [result] = await client.execute(
        "SELECT * FROM teachers WHERE teacher_id = ?",
        [teacherId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error changing teacher status: ${error.message}`);
    }
  }

  // إحصائيات المدرسين
  async getTeachersStats() {
    const query = `
    SELECT
      (SELECT COUNT(*) FROM teachers WHERE role = 'teacher') AS total,
      (SELECT COUNT(*) FROM teachers WHERE status = 'approved' AND role = 'teacher') AS approved,
      (SELECT COUNT(*) FROM teachers WHERE status = 'pending' AND role = 'teacher') AS pending,
      (SELECT COUNT(*) FROM teachers WHERE status = 'rejected' AND role = 'teacher') AS rejected,
      (SELECT COUNT(*) FROM teachers WHERE role = 'head_of_department' AND role = 'teacher') AS department_heads,
      (SELECT COUNT(*) FROM teachers WHERE role = 'assistant' AND role = 'teacher') AS teaching_assistants
  `;

    try {
      const [result] = await client.execute(query);
      return result[0];
    } catch (error) {
      throw new Error(`Error fetching teachers stats: ${error.message}`);
    }
  }

  //  مواد المدرس
  async getTeacherModules(teacherId) {
    const query = `
      SELECT 
        m.*,
        tm.assigned_at,
        tm.status as assignment_status,
        COUNT(DISTINCT se.student_id) as students_count
      FROM modules m
      INNER JOIN teacher_modules tm ON m.module_id = tm.module_id
      LEFT JOIN student_enrollments se ON m.module_id = se.module_id AND se.status = 'active'
      WHERE tm.teacher_id = ? AND tm.status = 'active'
      GROUP BY m.module_id, tm.assigned_at, tm.status
      ORDER BY tm.assigned_at DESC
    `;

    try {
      const [result] = await client.execute(query, [teacherId]);
      return result.map((row) => ({
        ...row,
        students_count: parseInt(row.students_count) || 0
      }));
    } catch (error) {
      throw new Error(`Error fetching teacher modules: ${error.message}`);
    }
  }

  // إضافة مادة للمدرس
  async assignModuleToTeacher(teacherId, moduleId, assignedBy = null) {
    const query = `
      INSERT INTO teacher_modules (teacher_id, module_id, assigned_by, status)
      VALUES (?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE 
      status = 'active', assigned_by = VALUES(assigned_by), assigned_at = NOW()
    `;

    try {
      const [result] = await client.execute(query, [
        teacherId,
        moduleId,
        assignedBy
      ]);
      //  السجل المُدرج أو المحدث
      const [assignmentResult] = await client.execute(
        "SELECT * FROM teacher_modules WHERE teacher_id = ? AND module_id = ?",
        [teacherId, moduleId]
      );
      return assignmentResult[0];
    } catch (error) {
      throw new Error(`Error assigning module to teacher: ${error.message}`);
    }
  }

  // إزالة مادة من المدرس
  async removeModuleFromTeacher(teacherId, moduleId) {
    const query = `
      UPDATE teacher_modules 
      SET status = 'inactive'
      WHERE teacher_id = ? AND module_id = ?
    `;

    try {
      await client.execute(query, [teacherId, moduleId]);
      const [result] = await client.execute(
        "SELECT * FROM teacher_modules WHERE teacher_id = ? AND module_id = ?",
        [teacherId, moduleId]
      );
      return result[0] || null;
    } catch (error) {
      throw new Error(`Error removing module from teacher: ${error.message}`);
    }
  }

  // تحديث مواد المدرس
  async updateTeacherModules(teacherId, moduleIds = [], updatedBy = null) {
    try {
      // بداية المعاملة
      await client.query("START TRANSACTION");

      // إلغاء تفعيل جميع المواد الحالية
      await client.execute(
        `UPDATE teacher_modules SET status = 'inactive' WHERE teacher_id = ?`,
        [teacherId]
      );

      // إضافة المواد الجديدة
      if (moduleIds && moduleIds.length > 0) {
        for (const moduleId of moduleIds) {
          await client.execute(
            `INSERT INTO teacher_modules (teacher_id, module_id, assigned_by, status)
             VALUES (?, ?, ?, 'active')
             ON DUPLICATE KEY UPDATE 
             status = 'active', assigned_by = VALUES(assigned_by), assigned_at = NOW()`,
            [teacherId, moduleId, updatedBy]
          );
        }
      }

      // إنهاء المعاملة
      await client.query("COMMIT");

      return { success: true };
    } catch (error) {
      // إلغاء المعاملة في حالة الخطأ
      await client.query("ROLLBACK");
      throw new Error(`Error updating teacher modules: ${error.message}`);
    }
  }
}

module.exports = new TeachersRepository();
