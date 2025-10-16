const { client } = require("../../config/db-connect");

async function getStudentModules({ studentId }) {
  const sql = `
    SELECT m.module_id, m.subject_name AS module_name, m.subject_code, m.subject_color
    FROM modules m
    WHERE m.status = 'active' AND m.module_id IN (
      SELECT se.module_id
      FROM student_enrollments se
      WHERE se.student_id = ? AND se.status = 'active'
    )
    ORDER BY m.subject_name
  `;
  const [rows] = await client.execute(sql, [studentId]);
  return rows;
}

async function countApprovedBooksByModule({ moduleId }) {
  const sql = `
    SELECT COUNT(*) AS total
    FROM ebooks e
    INNER JOIN units u ON u.unit_id = e.subject_id
    WHERE u.module_id = ? AND e.is_deleted = 0 AND e.status = 'active'
  `;
  const [rows] = await client.execute(sql, [moduleId]);
  return rows?.[0]?.total || 0;
}

async function listBooksByModule({
  moduleId,
  page = 1,
  limit = 12,
  search = "",
  studentId
}) {
  const where = ["u.module_id = ?", "e.is_deleted = 0", "e.status = 'active'"];
  const params = [moduleId];

  if (search && search.trim()) {
    where.push(
      "(e.book_title LIKE ? OR e.book_description LIKE ? OR e.author LIKE ?)"
    );
    params.push(
      `%${search.trim()}%`,
      `%${search.trim()}%`,
      `%${search.trim()}%`
    );
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderBy = "e.created_at";
  const orderDir = "DESC";
  
  const listSql = `
    SELECT 
      e.*,
      u.unit_id,
      u.unit_name,
      m.module_id,
      m.subject_name AS module_name,
      COALESCE(v.views, 0) AS views,
      ann.*,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'index_id', ei.ebook_index_id,
          'title', ei.index_title,
          'page', ei.page_number,
          'order', ei.order_index
        )
      ) AS indeces,
      CONCAT('', e.thumbnail) AS thumbnail_url,
      CONCAT('', e.file) AS file_url
    FROM ebooks e
    INNER JOIN units u ON u.unit_id = e.subject_id
    INNER JOIN modules m ON m.module_id = u.module_id
    LEFT JOIN ebook_views v ON v.ebook_id = e.ebook_id
    LEFT JOIN annotations ann ON ann.book_id = e.ebook_id AND ann.student_id = '${studentId}'
    LEFT JOIN ebook_indeces ei ON ei.ebook_id = e.ebook_id
    ${whereSql}
    GROUP BY e.ebook_id
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `;
  
  const countSql = `
    SELECT COUNT(*) AS total
    FROM ebooks e
    INNER JOIN units u ON u.unit_id = e.subject_id
    WHERE ${where.join(" AND ")}
  `;

  const [rows] = await client.execute(listSql, [...params, limit, offset]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;
  
  return {
    data: rows.map((r) => ({
      ebook_id: r.ebook_id,
      title: r.book_title,
      description: r.book_description,
      pages: r.pages,
      views: r.views,
      size_bytes: r.size,
      created_at: r.created_at,
      unit: { id: r.unit_id, name: r.unit_name },
      module: { id: r.module_id, name: r.module_name },
      file: r.file_url || r.file,
      thumbnail: r.thumbnail_url || r.thumbnail,
      ann_value: r.ann_value,
      indeces: r.indeces && r.indeces !== 'null' ? JSON.parse(r.indeces) : []
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}

async function listBooksByModuleByBulk({
  moduleId,
  page = 1,
  limit = 12,
  search = "",
  studentId
}) {
  // Create placeholders for the IN clause based on the number of module IDs
  const placeholders = moduleId.map(() => '?').join(',');
  const where = [`u.module_id IN (${placeholders})`, "e.is_deleted = 0", "e.status = 'active'"];
  const params = [...moduleId];

  if (search && search.trim()) {
    where.push(
      "(e.book_title LIKE ? OR e.book_description LIKE ? OR e.author LIKE ?)"
    );
    params.push(
      `%${search.trim()}%`,
      `%${search.trim()}%`,
      `%${search.trim()}%`
    );
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderBy = "e.created_at";
  const orderDir = "DESC";
  
  const listSql = `
    SELECT 
      e.*,
      u.unit_id,
      u.unit_name,
      m.module_id,
      m.subject_name AS module_name,
      COALESCE(v.views, 0) AS views,
      ann.*,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'index_id', ei.ebook_index_id,
          'title', ei.index_title,
          'page', ei.page_number,
          'order', ei.order_index
        )
      ) AS indeces,
      CONCAT('', e.thumbnail) AS thumbnail_url,
      CONCAT('', e.file) AS file_url
    FROM ebooks e
    INNER JOIN units u ON u.unit_id = e.subject_id
    INNER JOIN modules m ON m.module_id = u.module_id
    LEFT JOIN ebook_views v ON v.ebook_id = e.ebook_id
    LEFT JOIN annotations ann ON ann.book_id = e.ebook_id AND ann.student_id = '${studentId}'
    LEFT JOIN ebook_indeces ei ON ei.ebook_id = e.ebook_id
    ${whereSql}
    GROUP BY e.ebook_id
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `;
  
  const countSql = `
    SELECT COUNT(*) AS total
    FROM ebooks e
    INNER JOIN units u ON u.unit_id = e.subject_id
    WHERE ${where.join(" AND ")}
  `;

  const [rows] = await client.execute(listSql, [...params, limit, offset]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;
  
  return {
    data: rows.map((r) => ({
      ebook_id: r.ebook_id,
      title: r.book_title,
      description: r.book_description,
      pages: r.pages,
      views: r.views,
      size_bytes: r.size,
      created_at: r.created_at,
      unit: { id: r.unit_id, name: r.unit_name },
      module: { id: r.module_id, name: r.module_name },
      file: r.file_url || r.file,
      thumbnail: r.thumbnail_url || r.thumbnail,
      ann_value: r.ann_value,
      indeces: r.indeces && r.indeces !== 'null' ? JSON.parse(r.indeces) : []
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}



async function getBookDetails({ ebookId }) {
  const sql = `
    SELECT
      e.*, COALESCE(v.views, 0) AS views,
      u.unit_id, u.unit_name,
      m.module_id, m.subject_name AS module_name
    FROM ebooks e
    LEFT JOIN units u ON u.unit_id = e.subject_id
    LEFT JOIN modules m ON m.module_id = u.module_id
    LEFT JOIN ebook_views v ON v.ebook_id = e.ebook_id
    WHERE e.ebook_id = ? AND e.is_deleted = 0
  `;
  const [rows] = await client.execute(sql, [ebookId]);
  if (!rows.length) return null;
  const f = rows[0];
  return {
    ebook_id: f.ebook_id,
    title: f.book_title,
    description: f.book_description,
    pages: f.pages,
    views: f.views,
    size_bytes: f.size,
    created_at: f.created_at,
    unit: { id: f.unit_id, name: f.unit_name },
    module: { id: f.module_id, name: f.module_name },
    file: f.file,
    thumbnail: f.thumbnail
  };
}

async function incrementView({ ebookId }) {
  // Ensure ebook exists first (avoid FK errors)
  const existing = await getBookDetails({ ebookId });
  if (!existing) return null;

  const upsert = `
    INSERT INTO ebook_views (ebook_id, views, last_viewed)
    VALUES (?, 1, NOW())
    ON DUPLICATE KEY UPDATE views = views + 1, last_viewed = NOW()
  `;
  await client.execute(upsert, [ebookId]);
  return getBookDetails({ ebookId });
}

async function saveAnnotation({ annValue, bookId, studentId }) {
  const sql = `
    INSERT INTO annotations (ann_value, book_id, student_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE ann_value = VALUES(ann_value), updated_at = CURRENT_TIMESTAMP
  `;
  const [result] = await client.execute(sql, [annValue, bookId, studentId]);
  const [rows] = await client.execute(
    `SELECT ann_id, ann_value, book_id, student_id, created_at, updated_at FROM annotations WHERE book_id = ? AND student_id = ?`,
    [bookId, studentId]
  );
  return rows?.[0] || null;
}

module.exports = {
  getStudentModules,
  countApprovedBooksByModule,
  listBooksByModule,
  getBookDetails,
  incrementView,
  saveAnnotation,
  listBooksByModuleByBulk
};
