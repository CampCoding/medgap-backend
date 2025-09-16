const pgPool = require("pg")?.Pool;

const pgClient = new pgPool({
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DB,
  ssl: { rejectUnauthorized: false } // Add this line if SSL is required
});

// ---------------- MYSQL CONNECTION ----------------
const mysql2 = require("mysql2/promise");
const mysqlClient = mysql2.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

if (process.env.ENV == "development") {
  mysqlClient.getConnection();
} else {
  pgClient.connect();
}
 
module.exports = {
  client: process.env.ENV == "development" ? mysqlClient : pgClient
};
