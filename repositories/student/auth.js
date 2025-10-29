const { client } = require("../../config/db-connect");
const bcrypt = require("bcrypt");

const loginRepo = async ({ data }) => {
  const { email, password } = data;

  const [user] = await client.execute(
    "SELECT * FROM students WHERE email = ? AND status = 'active'",
    [email]
  );

  if (!user || user.length === 0) {
    return null;
  }

  //   console.log(await bcrypt.hash(password, 10));

  const isMatch = await bcrypt.compare(password, user[0]?.password || "");
  if (!isMatch) {
    return null;
  }

  delete user[0].password;
  user[0].image_url = user[0].image_url
    ? `https://api.medgap.net/${user[0].image_url}`
    : null;

  const { signAccessToken, signRefreshToken } = require("../../utils/jwt");
  const access = signAccessToken(
    {
      id: user[0].student_id,
      user: user[0],
    },
    "student"
  );

  const refresh = signRefreshToken(
    {
      id: user[0].student_id,
      user: user[0],
    },
    "student"
  );

  user[0].access = access;
  user[0].refresh = refresh;

  return user[0];
};

const registerRepo = async ({ data }) => {
  const { full_name, email, password, phone, date_of_birth, gender, address, university, grade, modules } =
    data;


  const [existingUser] = await client.execute(
    "SELECT student_id FROM students WHERE email = ?",
    [email]
  );

  if (existingUser && existingUser.length > 0) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `INSERT INTO students (full_name, email, password, phone, date_of_birth, gender, address, university, grade, status, enrollment_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURDATE())`;

  const params = [
    full_name,
    email,
    hashedPassword,
    phone || null,
    date_of_birth || null,
    gender || null,
    address || null,
    university || null,
    grade || null,
  ];

  const [result] = await client.execute(sql, params);
  console.log(result);
  if (result?.insertId) {
    // Determine modules to enroll based on grade
    let modulesToEnroll = [];
    console.log(grade)
    if (grade == "1") {
      modulesToEnroll = [23, 24];
    } else if (grade == "2") {
      modulesToEnroll = [25];
    }
    
    // Add any additional modules from the request
    if (modules && modules.length > 0) {
      modulesToEnroll = [...modulesToEnroll, ...modules];
    }
    console.log(modulesToEnroll);
    
    // Remove duplicates
    modulesToEnroll = [...new Set(modulesToEnroll)];
    
    // Insert modules
    if (modulesToEnroll.length > 0) {
      const moduleSql = `INSERT INTO student_enrollments (student_id, module_id, enrolled_at) VALUES (?, ?, ?)`;
      await Promise.all(
        modulesToEnroll.map(async (moduleId) => {
          await client.execute(moduleSql, [result.insertId, moduleId, new Date()]);
        })
      );
      console.log("modules enrolled successfully");
    }
  }
  return { student_id: result.insertId };
};

const getProfileRepo = async ({ studentId }) => {
  const [user] = await client.execute(
    "SELECT student_id, full_name, email, phone, date_of_birth, gender, address, university, grade, status, enrollment_date, image_url, created_at FROM students WHERE student_id = ?",
    [studentId]
  );

  if (!user || user.length === 0) {
    return null;
  }

  user[0].image_url = user[0].image_url
    ? `https://api.medgap.net/${user[0].image_url}`
    : null;
  return user[0];
};

const updateProfileRepo = async ({ studentId, data }) => {
  const { full_name, phone, date_of_birth, gender, address, university, grade } = data;
  
  // Prepare update fields and values
  const updateFields = [];
  const params = [];
  
  if (full_name) {
    updateFields.push("full_name = ?");
    params.push(full_name);
  }
  
  if (phone !== undefined) {
    updateFields.push("phone = ?");
    params.push(phone || null);
  }
  
  if (date_of_birth !== undefined) {
    updateFields.push("date_of_birth = ?");
    params.push(date_of_birth || null);
  }
  
  if (gender !== undefined) {
    updateFields.push("gender = ?");
    params.push(gender || null);
  }
  
  if (address !== undefined) {
    updateFields.push("address = ?");
    params.push(address || null);
  }
  
  if (university !== undefined) {
    updateFields.push("university = ?");
    params.push(university || null);
  }
  
  if (grade !== undefined) {
    updateFields.push("grade = ?");
    params.push(grade || null);
  }
  
  // If no fields to update, return early
  if (updateFields.length === 0) {
    return { success: false, message: "No fields to update" };
  }
  
  // Add student_id to params
  params.push(studentId);
  
  const sql = `UPDATE students SET ${updateFields.join(", ")} WHERE student_id = ?`;
  
  try {
    const [result] = await client.execute(sql, params);
    
    if (result.affectedRows > 0) {
      return { success: true, message: "Profile updated successfully" };
    } else {
      return { success: false, message: "Student not found or no changes made" };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const addStudentModulesRepo = async ({ studentId, modules }) => {
  // Validate modules input
  if (!modules || !Array.isArray(modules) || modules.length === 0) {
    return { success: false, message: "Invalid modules data" };
  }

  try {
    // Insert new modules
    const moduleSql = `INSERT INTO student_enrollments (student_id, module_id, enrolled_at) VALUES (?, ?, ?)`;
    await Promise.all(
      modules.map(async (moduleId) => {
        await client.execute(moduleSql, [studentId, moduleId, new Date()]);
      })
    );
    
    return { success: true, message: "Modules added successfully" };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const deleteStudentModuleRepo = async ({ studentId, moduleId }) => {
  // Validate input
  if (!moduleId) {
    return { success: false, message: "Module ID is required" };
  }

  try {
    // Delete the module enrollment
    const sql = `DELETE FROM student_enrollments WHERE student_id = ? AND module_id = ?`;
    const [result] = await client.execute(sql, [studentId, moduleId]);
    
    if (result.affectedRows > 0) {
      return { success: true, message: "Module removed successfully" };
    } else {
      return { success: false, message: "Module enrollment not found" };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  loginRepo,
  registerRepo,
  getProfileRepo,
  updateProfileRepo,
  addStudentModulesRepo,
  deleteStudentModuleRepo,
};
