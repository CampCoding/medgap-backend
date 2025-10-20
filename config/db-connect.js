// db.js
const { Pool } = require("pg");
const mysql2 = require("mysql2/promise");

// --------- ENV HELPERS ----------
const ENV = (process.env.ENV || process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();
  // console.log("ENV",ENV)
const USING_PG = false;

// --------- POSTGRES -------------
const pgClient = new Pool({
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DB,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// --------- MYSQL ----------------
const mysqlClient = mysql2.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 5, // Reduced from 10 to prevent connection limit issues
  queueLimit: 0,
  charset: "utf8mb4"
});

// --------- DRIVER SELECTION -----
let client;
if (USING_PG) {
  console.log("[DB] Using Postgres driver");
  client = pgClient;
  
} else {
  console.log("[DB] Using MySQL driver");
  client = mysqlClient;
 
}

module.exports = { client };
