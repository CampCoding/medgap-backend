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
      await conn.query(`ALTER TABLE new_student_plan_sessions ADD COLUMN study_day_date datetime DEFAULT NULL`);
      
      // await conn.query(`ALTER TABLE ebooks ADD COLUMN type ENUM('ebook', 'video', 'audio', 'summary', 'quiz', 'other') DEFAULT 'ebook'`);
//       await conn.query(`
//   CREATE TABLE new_student_plan_sessions (
//     session_id INT AUTO_INCREMENT PRIMARY KEY,
//     plan_id INT NOT NULL,
//     student_id INT NOT NULL,
//     study_day INT NOT NULL,
//     study_day_name VARCHAR(16),
//     qbank_id INT DEFAULT NULL,
//     exam_id INT DEFAULT NULL,
//     flashcarddeck_id INT DEFAULT NULL ,
//     ebook_id INT DEFAULT NULL, 
//     index_id INT DEFAULT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

//     -- Foreign key constraints (assuming other tables exist - adjust names if not)
//     FOREIGN KEY (plan_id) REFERENCES student_study_plans(plan_id) ON DELETE CASCADE,
//     FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
// );
        // `);

    
     
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