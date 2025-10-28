require("dotenv").config();

async function migrateMySQL() {
  const mysql = require("mysql2/promise");
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4",
  });
  const conn = await pool.getConnection();
  try {
    console.log("[migration][mysql] Checking for qbank.question_bank_per_session...");
    
      console.log("[migration][mysql] Adding question_bank_per_session INT DEFAULT 0...");
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN books text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN flashcardsDecks text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN flashcardsModules text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN booksIndeces text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN exams text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN questionBankModules text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN questionBankTopics text DEFAULT NULL`);
      // await conn.query(`ALTER TABLE student_study_plans ADD COLUMN questionBankSubject text DEFAULT NULL`);
      
      // await conn.query(`ALTER TABLE ebooks ADD COLUMN type ENUM('ebook', 'video', 'audio', 'summary', 'quiz', 'other') DEFAULT 'ebook'`);
      await conn.query(`ALTER TABLE student_plan_content ADD COLUMN exams_modules TEXT DEFAULT NULL`);

    
     
      console.log("[migration][mysql] Done.");
    
  } finally {
    conn.release();
    await pool.end();
  }
}

async function run() {
  // Prefer explicit driver var; otherwise infer from available envs
  const driver = "mysql"


  try {
    return await migrateMySQL();

  } catch (err) {
    console.error("[migration] Failed:", err.message);
    process.exitCode = 1;
  }
}

run();