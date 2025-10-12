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
    ? `https://camp-coding.site/medgap/${user[0].image_url}`
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
  const { full_name, email, password, phone, date_of_birth, gender, address } =
    data;

  // Check if email already exists
  const [existingUser] = await client.execute(
    "SELECT student_id FROM students WHERE email = ?",
    [email]
  );

  if (existingUser && existingUser.length > 0) {
    throw new Error("Email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `INSERT INTO students (full_name, email, password, phone, date_of_birth, gender, address, status, enrollment_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURDATE())`;

  const params = [
    full_name,
    email,
    hashedPassword,
    phone || null,
    date_of_birth || null,
    gender || null,
    address || null,
  ];

  const [result] = await client.execute(sql, params);
  return { student_id: result.insertId };
};

const getProfileRepo = async ({ studentId }) => {
  const [user] = await client.execute(
    "SELECT student_id, full_name, email, phone, date_of_birth, gender, address, status, enrollment_date, image_url, created_at FROM students WHERE student_id = ?",
    [studentId]
  );

  if (!user || user.length === 0) {
    return null;
  }

  user[0].image_url = user[0].image_url
    ? `https://camp-coding.site/medgap/${user[0].image_url}`
    : null;
  return user[0];
};

module.exports = {
  loginRepo,
  registerRepo,
  getProfileRepo,
};
