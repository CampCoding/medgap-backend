const { client } = require("../../config/db-connect");

// Check if we're using MySQL (development) or PostgreSQL (production)
const isMysql = process.env.ENV === "development";

// Get all quotes with pagination and search
async function getAllQuotes({
  offset = 0,
  limit = 20,
  search = "",
  category = "",
}) {
  let sql = `
    SELECT 
      q.*
    FROM daily_quotes q
    WHERE 1=1
  `;

  let params = [];

  if (search) {
    sql += ` AND (q.quote_text LIKE ? OR q.author LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    sql += ` AND q.category = ?`;
    params.push(category);
  }

  sql += ` ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  console.log(sql, params);
  const [rows] = isMysql
    ? await client.execute(sql, params)
    : await client.query(sql, params);

  // Get total count for pagination
  let countSql = `SELECT COUNT(*) as total FROM daily_quotes WHERE 1=1`;
  let countParams = [];

  if (search) {
    countSql += ` AND (quote_text LIKE ? OR author LIKE ?)`;
    countParams.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    countSql += ` AND category = ?`;
    countParams.push(category);
  }

  const [countResult] = isMysql
    ? await client.execute(countSql, countParams)
    : await client.query(countSql, countParams);
  const total = countResult[0].total;

  return {
    quotes: rows,
    pagination: {
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Get quote by ID
async function getQuoteById(quoteId) {
  const sql = `
    SELECT 
      q.*
    FROM daily_quotes q
    WHERE q.quote_id = ?
  `;

  const [rows] = isMysql
    ? await client.execute(sql, [quoteId])
    : await client.query(sql, [quoteId]);
  return rows.length > 0 ? rows[0] : null;
}

// Create new quote
async function createQuote({ quote_text, author, category, created_by }) {
  const sql = `
    INSERT INTO daily_quotes (quote_text, author, category, is_active)
    VALUES (?, ?, ?, 1)
  `;

  const [result] = isMysql
    ? await client.execute(sql, [quote_text, author, category])
    : await client.query(sql, [quote_text, author, category]);

  // Return the created quote
  return await getQuoteById(result.insertId);
}

// Update quote
async function updateQuote({
  quoteId,
  quote_text,
  author,
  category,
  is_active,
  updated_by,
}) {
  const sql = `
    UPDATE daily_quotes 
    SET quote_text = ?, author = ?, category = ?, is_active = ?
    WHERE quote_id = ?
  `;

  const [result] = isMysql
    ? await client.execute(sql, [
        quote_text,
        author,
        category,
        is_active,
        quoteId,
      ])
    : await client.query(sql, [
        quote_text,
        author,
        category,
        is_active,
        quoteId,
      ]);

  return result.affectedRows > 0;
}

// Delete quote
async function deleteQuote(quoteId) {
  const sql = `DELETE FROM daily_quotes WHERE quote_id = ?`;
  const [result] = isMysql
    ? await client.execute(sql, [quoteId])
    : await client.query(sql, [quoteId]);

  return result.affectedRows > 0;
}

// Get quote categories
async function getQuoteCategories() {
  const sql = `
    SELECT DISTINCT category, COUNT(*) as count
    FROM daily_quotes 
    WHERE is_active = 1
    GROUP BY category
    ORDER BY category
  `;

  const [rows] = isMysql ? await client.execute(sql) : await client.query(sql);
  return rows;
}

// Get random active quote for daily display
async function getRandomQuote() {
  const sql = `
    SELECT * FROM daily_quotes 
    WHERE is_active = 1 
    ORDER BY RAND() 
    LIMIT 1
  `;

  const [rows] = isMysql ? await client.execute(sql) : await client.query(sql);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  getAllQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  getQuoteCategories,
  getRandomQuote,
};
