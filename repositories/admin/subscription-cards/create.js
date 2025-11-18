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

const fetchResourceDetails = async (type, ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(Number(id))))];
  if (!uniqueIds.length) return [];

  const placeholders = uniqueIds.map(() => "?").join(",");

  switch (type) {
    case "book": {
      const [rows] = await client.execute(
        `SELECT ebook_id AS id, book_title AS name, book_description AS description
         FROM ebooks WHERE ebook_id IN (${placeholders})`,
        uniqueIds
      );
      return rows;
    }
    case "topic": {
      const [rows] = await client.execute(
        `SELECT topic_id AS id, topic_name AS name, short_description AS description
         FROM topics WHERE topic_id IN (${placeholders})`,
        uniqueIds
      );
      return rows;
    }
    case "exam": {
      const [rows] = await client.execute(
        `SELECT exam_id AS id, title AS name, difficulty
         FROM exams WHERE exam_id IN (${placeholders})`,
        uniqueIds
      );
      return rows;
    }
    case "module": {
      const [rows] = await client.execute(
        `SELECT module_id AS id, subject_name AS name, subject_code AS code
         FROM modules WHERE module_id IN (${placeholders})`,
        uniqueIds
      );
      return rows;
    }
    default:
      return [];
  }
};

const fetchCardUsage = async (cardId) => {
  const [rows] = await client.execute(
    `SELECT 
        ss.subscription_id,
        ss.student_id,
        s.full_name AS student_name,
        ss.resource_id,
        ss.status,
        ss.created_at AS used_at,
        ss.end_date,
        m.module_id,
        m.subject_name,
        t.topic_id,
        t.topic_name,
        ex.exam_id,
        ex.title AS exam_title,
        b.ebook_id,
        b.book_title
     FROM student_subscription ss
     LEFT JOIN students s ON s.student_id = ss.student_id
     LEFT JOIN modules m ON m.module_id = ss.resource_id
     LEFT JOIN topics t ON t.topic_id = ss.resource_id
     LEFT JOIN exams ex ON ex.exam_id = ss.resource_id
     LEFT JOIN ebooks b ON b.ebook_id = ss.resource_id
     WHERE ss.card_id = ?
     ORDER BY ss.created_at DESC`,
    [cardId]
  );

  return rows.map((row) => {
    let resourceType = "unknown";
    let resourceName = null;
    let resolvedResourceId = row.resource_id;

    if (row.module_id) {
      resourceType = "module";
      resourceName = row.subject_name;
      resolvedResourceId = row.module_id;
    } else if (row.topic_id) {
      resourceType = "topic";
      resourceName = row.topic_name;
      resolvedResourceId = row.topic_id;
    } else if (row.exam_id) {
      resourceType = "exam";
      resourceName = row.exam_title;
      resolvedResourceId = row.exam_id;
    } else if (row.ebook_id) {
      resourceType = "book";
      resourceName = row.book_title;
      resolvedResourceId = row.ebook_id;
    }

    return {
      subscription_id: row.subscription_id,
      student_id: row.student_id,
      student_name: row.student_name,
      resource_id: resolvedResourceId,
      resource_type: resourceType,
      resource_name: resourceName,
      status: row.status,
      used_at: row.used_at,
      end_date: row.end_date,
    };
  });
};

const extractIdsFromSource = (source) => {
  const ids = [];

  const traverse = (value) => {
    if (Array.isArray(value)) {
      value.forEach(traverse);
      return;
    }

    if (Number.isFinite(Number(value))) {
      ids.push(Number(value));
      return;
    }

    if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(traverse);
    }
  };

  traverse(source);
  return [...new Set(ids)];
};

const listSubscriptionCards = async ({
  type,
  status,
  resourceId,
  page = 1,
  limit = 1000,
}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pageNumber - 1) * safeLimit;

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
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TABLE_NAME}
    ${where}
  `;

  const [rows] = await client.execute(sql, [...params, safeLimit, offset]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;

  const cardsWithDetails = await Promise.all(
    rows.map(async (row) => {
      const parsedSource = parseSource(row.source);
      const resourceIds = extractIdsFromSource(parsedSource);
      const resources = await fetchResourceDetails(row.type, resourceIds);
      const usage = await fetchCardUsage(row.card_id);

      return {
        ...row,
        source: parsedSource,
        resources,
        usage,
        used: usage.length > 0,
        used_count: usage.length,
        last_used_at: usage.length > 0 ? usage[0].used_at : null,
      };
    })
  );

  return {
    cards: cardsWithDetails,
    pagination: {
      total,
      page: pageNumber,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 0,
    },
  };
};

module.exports = {
  createSubscriptionCards,
  listSubscriptionCards,
};

