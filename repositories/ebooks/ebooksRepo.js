const { client } = require("../../config/db-connect");

/** ===================== Helpers ===================== */
const ALLOWED_UPDATE_FIELDS = new Set([
  "subject_id",
  "book_title", 
  "book_description",
  "author",
  "file",
  "pages",
  "thumbnail",
  "status",
  "size",
  "type"
]);

function buildUpdateSet(data = {}) {
  const sets = [];
  const params = [];

  for (const [k, v] of Object.entries(data)) {
    if (!ALLOWED_UPDATE_FIELDS.has(k)) continue;

    if (k === "pages") {
      const num = Number(v);
      if (!Number.isFinite(num)) continue;
      sets.push("pages = ?");
      params.push(num);
      continue;
    }
    sets.push(`${k} = ?`);
    params.push(v);
  }

  sets.push("updated_at = NOW()");
  return { sets, params };
}

/** ===================== Create ===================== */
async function createRepo(data) {
  const date = new Date();
  const insertSql = `
    INSERT INTO ebooks
      (subject_id, book_title, book_description, author, file, pages, thumbnail, status, is_deleted, created_by, created_at, updated_at, size, type)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)
  `;
  const [result] = await client.execute(insertSql, [
    data?.subject_id,
    data?.book_title,
    data?.book_description,
    data?.author,
    data?.file,
    parseInt(data?.pages),
    data?.thumbnail,
    data?.status || "active",
    0,
    date,
    data?.size,
    data?.type || "ebook"
  ]);

  if (result?.insertId)
    await Promise.all(
      data?.index?.map(async (item) => {
        const date = new Date();
        const insertIndexSql = `
    INSERT INTO ebook_indeces (ebook_index_id, ebook_id, parent_id, level, order_index, index_title, page_number, created_at) VALUES (NULL, ?, NULL, '1', ?, ?, ?, ?)
  `;
        await client.execute(insertIndexSql, [
          result?.insertId,
          item?.order,
          item?.title,
          item?.page,
          date
        ]);
      })
    );

  return result?.insertId || null;
}

/** ===================== Update ===================== */

async function updateRepo(id, data = {}) {
  if (!id) throw new Error("ebook id is required");

  const { sets, params } = buildUpdateSet(data);
  if (sets.length === 1) {
    return { affectedRows: 0, changedRows: 0 };
  }
  console.log([...params, id]);

  const sql = `UPDATE ebooks SET ${sets.join(
    ", "
  )} WHERE ebook_id = ?`;
  const [result] = await client.execute(sql, [...params, id]);

  if (data?.index) {
    const optionsToUpdate = [];
    const optionsToDelete = [];
    const optionsToInsert = [];

    for (const index of data.index) {
      if (index.ebook_index_id) {
        if (index._delete == "true") {
          optionsToDelete.push(index.ebook_index_id);
        } else {
          optionsToUpdate.push(index);
        }
      } else {
        optionsToInsert.push(index);
      }
    }
console.log(optionsToDelete?.join(","))
    if (optionsToDelete.length > 0) {
      const deleteIndicesSql = `DELETE FROM ebook_indeces WHERE ebook_index_id IN (?)`;
      await client.execute(deleteIndicesSql, [optionsToDelete?.join(",")]);
    }

    if (optionsToUpdate.length > 0) {
      const updateIndexSql = `
        UPDATE ebook_indeces
        SET index_title = ?, page_number = ?, order_index = ?, created_at = NOW()
        WHERE ebook_index_id = ?
      `;
      for (const index of optionsToUpdate) {
        await client.execute(updateIndexSql, [
          index.index_title,
          index.page_number || 0,
          index.order_index || 0,
          index.ebook_index_id
        ]);
      }
    }

    if (optionsToInsert.length > 0) {
      const insertIndexSql = `
        INSERT INTO ebook_indeces (ebook_index_id, ebook_id, parent_id, level, order_index, index_title, page_number, created_at)
        VALUES (NULL, ?, NULL, '1', ?, ?, ?, NOW())
      `;
      for (const index of optionsToInsert) {
        await client.execute(insertIndexSql, [
          id,
          index.order || 0,
          index.title,
          index.page || 0
        ]);
      }
    }
  }

  return result;
}

/** ===================== Delete ===================== */
async function deleteRepo(id, { hard = false } = {}) {
  if (!id) throw new Error("ebook id is required");
  if (hard) {
    const [result] = await client.execute(
      `DELETE FROM ebooks WHERE ebook_id = ?`,
      [id]
    );
    return result;
  }

  const [result] = await client.execute(
    `UPDATE ebooks SET is_deleted = 1, status = 'inactive', updated_at = NOW() WHERE ebook_id = ?`,
    [id]
  );
  return result;
}

/** ===================== Restore ===================== */
async function restoreRepo(id) {
  if (!id) throw new Error("ebook id is required");
  const [result] = await client.execute(
    `UPDATE ebooks SET is_deleted = 0, updated_at = NOW() WHERE ebook_id = ?`,
    [id]
  );
  return result;
}

/** ===================== Show / Hide ===================== */
async function setVisibilityRepo(id, visible) {
  if (!id) throw new Error("ebook id is required");
  const status = visible ? "active" : "inactive";
  const [result] = await client.execute(
    `UPDATE ebooks SET status = ?, updated_at = NOW() WHERE ebook_id = ? AND is_deleted = 0`,
    [status, id]
  );
  return result;
}

/** ===================== Show / Hide ===================== */
async function toggleVisibilityRepo(id) {
  if (!id) throw new Error("ebook id is required");
  const sql = `
    UPDATE ebooks
    SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END,
        updated_at = NOW()
    WHERE ebook_id = ? AND is_deleted = 0
  `;
  const [result] = await client.execute(sql, [id]);
  return result;
}

/** ===================== Get by ID ===================== */
async function getByIdRepo(id, { includeDeleted = false } = {}) {
  if (!id) throw new Error("ebook id is required");
  const where = includeDeleted ? `id = ?` : `id = ? AND is_deleted = 0`;
  const [rows] = await client.execute(
    `SELECT * FROM ebooks WHERE ${where} LIMIT 1`,
    [id]
  );
  return rows?.[0] || null;
}

/** ===================== List + Filters + Pagination ===================== */
async function listRepo({
  page = 1,
  pageSize = 20,
  subject_id,
  book_id,
  module_id,
  status,
  type,
  search,
  includeDeleted = false,
  orderBy = "created_at",
  orderDir = "DESC"
} = {}) {
  const allowedOrderBy = new Set([
    "created_at",
    "updated_at",
    "book_title",
    "pages",
    "id",
    "type"
  ]);
  const allowedDir = new Set(["ASC", "DESC"]);

  if (!allowedOrderBy.has(orderBy)) orderBy = "created_at";
  if (!allowedDir.has(orderDir)) orderDir = "DESC";

  const where = [];
  const params = [];

  if (!includeDeleted) {
    where.push("is_deleted = 0");
  }
  if (module_id) {
    where.push("module_id = ?");
    params.push(module_id);
  }
  if (subject_id) {
    where.push("subject_id = ?");
    params.push(subject_id);
  }
  if (book_id) {
    where.push("ebook_id = ?");
    params.push(book_id);
  }
  if (status) {
    where.push("status = ? ");
    params.push(status);
  }
  if (type) {
    where.push("type = ? ");
    params.push(type);
  }
  if (search && search.trim()) {
    where.push(
      "(book_title LIKE CONCAT('%', ?, '%') OR author LIKE CONCAT('%', ?, '%') OR book_description LIKE CONCAT('%', ?, '%')) "
    );
    params.push(search.trim(), search.trim(), search.trim());
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
  const limit = Math.max(1, pageSize);

  const listSql = `
    SELECT ebooks.*,
    JSON_ARRAYAGG(
    JSON_OBJECT(
    'index_id', ebook_indeces.ebook_index_id,
    'title', ebook_indeces.index_title,
    'page', ebook_indeces.page_number,
    'order',ebook_indeces.order_index
    )
    ) AS indecies,
    CONCAT('https://camp-coding.site/medgap', thumbnail) AS thumbnail,
    CONCAT('https://camp-coding.site/medgap', file) AS file
    FROM ebooks
    LEFT JOIN ebook_indeces ON ebook_indeces.ebook_id = ebooks.ebook_id
    ${whereSql}
    GROUP BY ebooks.ebook_id
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?

  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ebooks
    ${whereSql}
  `;

  let [rows] = await client.execute(listSql, [...params, limit, offset]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;
  rows = rows
    ?.map((item) => {
      if (item.indecies) {
        item.indecies = JSON.parse(item.indecies);
        item.indecies =
          Array.isArray(item.indecies) &&
          item.indecies
            ?.filter((item) => item.index_id)
            ?.sort((a, b) => parseInt(a?.order) - parseInt(b?.order));
      }

      return item;
    })
    ?.sort((a, b) => parseInt(b?.ebook_id) - parseInt(a?.ebook_id));
  return {
    data: rows,
    page,
    pageSize: limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  createRepo,
  updateRepo,
  deleteRepo,
  restoreRepo,
  setVisibilityRepo,
  toggleVisibilityRepo,
  getByIdRepo,
  listRepo
};
