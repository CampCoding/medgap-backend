const { client } = require("../../../config/db-connect");

const TABLE_NAME = "subscription_cards";

const parseSource = (value) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const insertCard = async ({ code, type, endDate, status, source }) => {
  const [result] = await client.execute(
    `INSERT INTO ${TABLE_NAME} (code, type, end_date, status, source)
     VALUES (?, ?, ?, ?, ?)`,
    [code, type, endDate, status, JSON.stringify(source)]
  );

  return {
    card_id: result.insertId,
    code,
    type,
    end_date: endDate,
    status,
    source,
  };
};

const createSubscriptionCards = async ({ codes, type, endDate, status, source }) => {
  const created = [];

  for (const code of codes) {
    const card = await insertCard({ code, type, endDate, status, source });
    created.push(card);
  }

  return created;
};

const buildFilters = ({ type, status, resourceId }) => {
  const filters = [];
  const params = [];

  if (type) {
    filters.push("type = ?");
    params.push(type);
  }

  if (status) {
    filters.push("status = ?");
    params.push(status);
  }

  if (resourceId !== undefined) {
    filters.push("JSON_CONTAINS(source, ?)");
    params.push(JSON.stringify(resourceId));
  }

  return {
    where: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    params,
  };
};

const listSubscriptionCards = async ({ type, status, resourceId }) => {
  const { where, params } = buildFilters({ type, status, resourceId });
  const sql = `
    SELECT 
      card_id,
      code,
      type,
      end_date,
      status,
      source,
      created_at,
      updated_at
    FROM ${TABLE_NAME}
    ${where}
    ORDER BY created_at DESC
  `;

  const [rows] = await client.execute(sql, params);

  return rows.map((row) => ({
    ...row,
    source: parseSource(row.source),
  }));
};

module.exports = {
  createSubscriptionCards,
  listSubscriptionCards,
};

