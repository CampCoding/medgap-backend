const { client } = require("../../config/db-connect");

const CARD_TABLE = "subscription_cards";
const STUDENT_TABLE = "student_subscription";

const CODE_LENGTH = 14;

const parseJSON = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const normalizeCode = (code = "") =>
  (code ?? "").toString().replace(/\D/g, "");

const formatCode = (code = "") => {
  const digits = normalizeCode(code);
  if (digits.length !== CODE_LENGTH) return null;
  return digits;
};

const findActiveCardByCode = async ({ code }) => {
  const normalizedCode = formatCode(code);
  if (!normalizedCode) return null;

  const [rows] = await client.execute(
    `SELECT *
     FROM ${CARD_TABLE}
     WHERE code = ?
     LIMIT 1`,
    [normalizedCode]
  );

  if (!rows.length) return null;

  const card = rows[0];
  return {
    ...card,
    source: parseJSON(card.source),
  };
};

const resourceIdFromSource = (type, source) => {
  if (source === null || source === undefined) return [];
  if (Array.isArray(source)) {
    return source.map((item) => Number(item)).filter((id) => Number.isFinite(id));
  }

  if (typeof source === "object") {
    const keyMap = {
      book: ["book", "books"],
      topic: ["topic", "topics"],
      exam: ["exam", "exams"],
      module: ["module", "modules"],
    };
    const keys = keyMap[type] || [];
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value.map((item) => Number(item)).filter((id) => Number.isFinite(id));
      }
      if (Number.isFinite(Number(value))) {
        return [Number(value)];
      }
    }

    if (Array.isArray(source.ids)) {
      return source.ids
        .map((item) => Number(item))
        .filter((id) => Number.isFinite(id));
    }
  }

  if (Number.isFinite(Number(source))) {
    return [Number(source)];
  }

  return [];
};

const existingActiveSubscription = async ({ studentId, resourceId }) => {
  const [rows] = await client.execute(
    `SELECT subscription_id
     FROM ${STUDENT_TABLE}
     WHERE student_id = ?
       AND resource_id = ?
       AND status = 'active'
       AND end_date >= CURDATE()
     LIMIT 1`,
    [studentId, resourceId]
  );

  return rows[0] || null;
};

const insertStudentSubscription = async ({
  studentId,
  resourceId,
  cardId,
  endDate,
}) => {
  const [result] = await client.execute(
    `INSERT INTO ${STUDENT_TABLE}
      (student_id, resource_id, card_id, end_date, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [studentId, resourceId, cardId, endDate]
  );

  return {
    subscription_id: result.insertId,
    student_id: studentId,
    resource_id: resourceId,
    card_id: cardId,
    end_date: endDate,
    status: "active",
  };
};

const getModuleResources = async ({ moduleId }) => {
  // Get all topics for the module
  const [topics] = await client.execute(
    `SELECT DISTINCT t.topic_id
     FROM topics t
     INNER JOIN units u ON u.unit_id = t.unit_id
     WHERE u.module_id = ? AND t.status = 'active' AND u.status = 'active'`,
    [moduleId]
  );

  // Get all exams for the module
  const [exams] = await client.execute(
    `SELECT DISTINCT e.exam_id
     FROM exams e
     WHERE e.subject_id = ? AND e.status IN ('published', 'scheduled')`,
    [moduleId]
  );

  // Get all books for the module
  const [books] = await client.execute(
    `SELECT DISTINCT e.ebook_id
     FROM ebooks e
     INNER JOIN units u ON u.unit_id = e.subject_id
     WHERE u.module_id = ? AND e.is_deleted = 0 AND e.status = 'active'`,
    [moduleId]
  );

  return {
    topics: topics.map((t) => t.topic_id),
    exams: exams.map((e) => e.exam_id),
    books: books.map((b) => b.ebook_id),
  };
};

const redeemCardForStudent = async ({ studentId, code }) => {
  const card = await findActiveCardByCode({ code });
  if (!card) {
    return { card: null, subscriptions: [] };
  }

  if (card.status !== "active") {
    return { card, subscriptions: [], error: "inactive-card" };
  }

  if (card.end_date && new Date(card.end_date) < new Date()) {
    return { card, subscriptions: [], error: "card-expired" };
  }

  const createdSubscriptions = [];

  // Handle module type - get all resources linked to the module
  if (card.type === "module") {
    const moduleIds = resourceIdFromSource(card.type, card.source);
    if (!moduleIds.length) {
      return { card, subscriptions: [], error: "no-resources" };
    }

    for (const moduleId of moduleIds) {
      const resources = await getModuleResources({ moduleId });
      const allResourceIds = [
        ...resources.topics,
        ...resources.exams,
        ...resources.books,
      ];

      for (const resourceId of allResourceIds) {
        const existing = await existingActiveSubscription({ studentId, resourceId });
        if (existing) {
          createdSubscriptions.push({
            subscription_id: existing.subscription_id,
            resource_id: resourceId,
            status: "already_active",
          });
          continue;
        }

        const inserted = await insertStudentSubscription({
          studentId,
          resourceId,
          cardId: card.card_id,
          endDate: card.end_date,
        });
        createdSubscriptions.push({ ...inserted, status: "created" });
      }
    }
  } else {
    // Handle book, topic, exam types (existing logic)
    const resourceIds = resourceIdFromSource(card.type, card.source);
    if (!resourceIds.length) {
      return { card, subscriptions: [], error: "no-resources" };
    }

    for (const resourceId of resourceIds) {
      const existing = await existingActiveSubscription({ studentId, resourceId });
      if (existing) {
        createdSubscriptions.push({
          subscription_id: existing.subscription_id,
          resource_id: resourceId,
          status: "already_active",
        });
        continue;
      }

      const inserted = await insertStudentSubscription({
        studentId,
        resourceId,
        cardId: card.card_id,
        endDate: card.end_date,
      });
      createdSubscriptions.push({ ...inserted, status: "created" });
    }
  }

  return { card, subscriptions: createdSubscriptions };
};

module.exports = {
  redeemCardForStudent,
};

