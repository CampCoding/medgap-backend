const { client } = require("../../config/db-connect");

const RESOURCE_MAP = {
  book: {
    table: "ebooks",
    idColumn: "ebook_id",
    ownerColumn: null,
  },
  topic: {
    table: "topics",
    idColumn: "topic_id",
    ownerColumn: "teacher_id",
  },
  exam: {
    table: "exams",
    idColumn: "exam_id",
    ownerColumn: "teacher_id",
  },
};

const normalizeFreeValue = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  value === "true" ||
  value === "FREE";

async function updateFreeFlag({
  resourceType,
  resourceId,
  free,
  teacherId = null,
}) {
  const meta = RESOURCE_MAP[resourceType];
  if (!meta) {
    throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  const freeValue = normalizeFreeValue(free) ? 1 : 0;
  const params = [freeValue, resourceId];

  let ownerClause = "";
  if (teacherId && meta.ownerColumn) {
    ownerClause = ` AND ${meta.ownerColumn} = ?`;
    params.push(teacherId);
  } else if (teacherId && !meta.ownerColumn) {
    return { affectedRows: 0, forbidden: true };
  }

  const sql = `
    UPDATE ${meta.table}
    SET free = ?, updated_at = NOW()
    WHERE ${meta.idColumn} = ?${ownerClause}
  `;

  const [result] = await client.execute(sql, params);
  if (!result.affectedRows) {
    return { affectedRows: 0 };
  }

  const [rows] = await client.execute(
    `SELECT * FROM ${meta.table} WHERE ${meta.idColumn} = ?`,
    [resourceId]
  );

  return {
    affectedRows: result.affectedRows,
    record: rows?.[0] || null,
  };
}

module.exports = {
  updateFreeFlag,
};

