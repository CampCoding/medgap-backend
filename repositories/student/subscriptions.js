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
  
  // Enhanced parsing - handle multiple formats
  let parsedSource = card.source;
  
  // If it's a string, try to parse it
  if (typeof card.source === 'string') {
    try {
      parsedSource = JSON.parse(card.source);
    } catch (e) {
      // If parsing fails, keep as string
      parsedSource = card.source;
    }
  }
  
  // If it's already an object, use it directly
  if (typeof card.source === 'object' && card.source !== null) {
    parsedSource = card.source;
  }
  
  console.log(`[findActiveCardByCode] Raw source from DB:`, card.source);
  console.log(`[findActiveCardByCode] Raw source type:`, typeof card.source);
  console.log(`[findActiveCardByCode] Parsed source:`, parsedSource);
  console.log(`[findActiveCardByCode] Parsed source type:`, typeof parsedSource);
  
  return {
    ...card,
    source: parsedSource,
  };
};

const extractIdsFromItem = (item) => {
  const ids = [];

  if (Array.isArray(item)) {
    item.forEach((subItem) => {
      ids.push(...extractIdsFromItem(subItem));
    });
    return ids;
  }

  if (Number.isFinite(Number(item))) {
    ids.push(Number(item));
    return ids;
  }

  if (typeof item === "object" && item !== null) {
    const candidateKeys = [
      "id",
      "book_id",
      "topic_id",
      "exam_id",
      "resource_id",
      "module_id",
      "value",
    ];

    for (const key of candidateKeys) {
      if (item[key] !== undefined && Number.isFinite(Number(item[key]))) {
        ids.push(Number(item[key]));
      }
    }

    // Inspect nested values
    Object.values(item).forEach((nestedValue) => {
      ids.push(...extractIdsFromItem(nestedValue));
    });
  }

  return ids;
};

const resourceIdFromSource = (type, source) => {
  if (source === null || source === undefined) {
    console.log(`[resourceIdFromSource] Source is null/undefined for type: ${type}`);
    return [];
  }

  // Handle array directly
  if (Array.isArray(source)) {
    const ids = source
      .flatMap((item) => extractIdsFromItem(item))
      .filter((id) => Number.isFinite(id));
    console.log(`[resourceIdFromSource] Array source for type ${type}:`, ids);
    return ids;
  }

  // Handle object
  if (typeof source === "object") {
    const keyMap = {
      book: ["book", "books", "ebook", "ebooks"],
      topic: ["topic", "topics"],
      exam: ["exam", "exams"],
      module: ["module", "modules"],
    };
    const keys = keyMap[type] || [];
    
    console.log(`[resourceIdFromSource] Object source for type ${type}:`, JSON.stringify(source));
    console.log(`[resourceIdFromSource] Looking for keys:`, keys);
    
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        const idsFromValue = extractIdsFromItem(value).filter((id) => Number.isFinite(id));
        if (idsFromValue.length > 0) {
          console.log(`[resourceIdFromSource] Extracted IDs from key "${key}":`, idsFromValue);
          return idsFromValue;
        }
      }
    }

    // Fallback: check for "ids" key
    if (Array.isArray(source.ids)) {
      const ids = source.ids
        .flatMap((item) => extractIdsFromItem(item))
        .filter((id) => Number.isFinite(id));
      console.log(`[resourceIdFromSource] Found ids array:`, ids);
      if (ids.length > 0) return ids;
    }

    // Fallback: check all numeric values in the object
    const numericValues = Object.values(source)
      .flatMap((item) => extractIdsFromItem(item))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (numericValues.length > 0) {
      console.log(`[resourceIdFromSource] Found numeric values in object:`, numericValues);
      return numericValues;
    }
  }

  // Handle direct number/string
  if (Number.isFinite(Number(source))) {
    const id = Number(source);
    console.log(`[resourceIdFromSource] Direct number:`, id);
    return [id];
  }

  console.log(`[resourceIdFromSource] No valid IDs found for type ${type}, source:`, JSON.stringify(source));
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

// Check if a card has already been used to create any student subscription
const isCardAlreadyUsed = async ({ cardId }) => {
  const [rows] = await client.execute(
    `SELECT 1
     FROM ${STUDENT_TABLE}
     WHERE card_id = ?
     LIMIT 1`,
    [cardId]
  );

  return rows.length > 0;
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

const enrollStudentInModule = async ({ studentId, moduleId }) => {
  // Check if already enrolled
  const [existing] = await client.execute(
    `SELECT enrollment_id, status
     FROM student_enrollments
     WHERE student_id = ? AND module_id = ?`,
    [studentId, moduleId]
  );

  if (existing.length > 0) {
    // If enrolled but inactive, reactivate it
    if (existing[0].status !== 'active') {
      await client.execute(
        `UPDATE student_enrollments
         SET status = 'active', enrolled_at = CURDATE()
         WHERE student_id = ? AND module_id = ?`,
        [studentId, moduleId]
      );
      return { enrolled: true, status: 'reactivated' };
    }
    return { enrolled: true, status: 'already_active' };
  }

  // Create new enrollment
  await client.execute(
    `INSERT INTO student_enrollments (student_id, module_id, enrolled_at, status)
     VALUES (?, ?, CURDATE(), 'active')`,
    [studentId, moduleId]
  );

  return { enrolled: true, status: 'created' };
};

const getModuleResources = async ({ moduleId }) => {
  console.log(`[getModuleResources] Fetching resources for module ${moduleId}`);
  
  // Get all topics for the module
  const [topics] = await client.execute(
    `SELECT DISTINCT t.topic_id
     FROM topics t
     INNER JOIN units u ON u.unit_id = t.unit_id
     WHERE u.module_id = ? AND t.status = 'active' AND u.status = 'active'`,
    [moduleId]
  );
  console.log(`[getModuleResources] Found ${topics.length} topics:`, topics.map(t => t.topic_id));

  // Get all exams for the module
  const [exams] = await client.execute(
    `SELECT DISTINCT e.exam_id
     FROM exams e
     WHERE e.subject_id = ? AND e.status IN ('published', 'scheduled')`,
    [moduleId]
  );
  console.log(`[getModuleResources] Found ${exams.length} exams:`, exams.map(e => e.exam_id));

  // Get all books for the module
  const [books] = await client.execute(
    `SELECT DISTINCT e.ebook_id
     FROM ebooks e
     INNER JOIN units u ON u.unit_id = e.subject_id
     WHERE u.module_id = ? AND e.is_deleted = 0 AND e.status = 'active'`,
    [moduleId]
  );
  console.log(`[getModuleResources] Found ${books.length} books:`, books.map(b => b.ebook_id));

  const result = {
    topics: topics.map((t) => t.topic_id),
    exams: exams.map((e) => e.exam_id),
    books: books.map((b) => b.ebook_id),
  };
  
  console.log(`[getModuleResources] Returning resources:`, result);
  return result;
};

const redeemCardForStudent = async ({ studentId, code }) => {
  const card = await findActiveCardByCode({ code });
  if (!card) {
    return { card: null, subscriptions: [] };
  }

  // Prevent reusing a card that has already been used for any subscription
  const cardUsed = await isCardAlreadyUsed({ cardId: card.card_id });
  if (cardUsed) {
    console.log(`[redeemCardForStudent] Card ${card.card_id} has already been used`);
    return { card, subscriptions: [], error: "card-used" };
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
   
    
    let moduleIds = resourceIdFromSource(card.type, card.source);
    
    // If no IDs found, try alternative parsing
    if (!moduleIds.length && card.source) {
      // Try parsing as string if it's a string
      if (typeof card.source === 'string') {
        try {
          const parsed = JSON.parse(card.source);
          console.log(`[redeemCardForStudent] Re-parsed source string:`, parsed);
          moduleIds = resourceIdFromSource(card.type, parsed);
        } catch (e) {
          console.log(`[redeemCardForStudent] Failed to re-parse source string:`, e.message);
        }
      }
      
      // If still no IDs, try extracting from any numeric values
      if (!moduleIds.length && typeof card.source === 'object' && card.source !== null) {
        const allValues = Object.values(card.source);
        const numericValues = allValues
          .flatMap(v => Array.isArray(v) ? v : [v])
          .map(v => Number(v))
          .filter(v => Number.isFinite(v) && v > 0);
        if (numericValues.length > 0) {
          console.log(`[redeemCardForStudent] Using fallback numeric extraction:`, numericValues);
          moduleIds = numericValues;
        }
      }
    }
    
    console.log(`[redeemCardForStudent] Final extracted module IDs:`, moduleIds);
    
    if (!moduleIds.length) {
      console.log(`[redeemCardForStudent] ERROR: No module IDs found. Source was:`, JSON.stringify(card.source));
      console.log(`[redeemCardForStudent] Card full object:`, JSON.stringify(card, null, 2));
      return { card, subscriptions: [], error: "no-resources" };
    }

    const enrollments = [];
    for (const moduleId of moduleIds) {
      // Enroll student in the module
      const enrollment = await enrollStudentInModule({ studentId, moduleId });
      enrollments.push({ module_id: moduleId, ...enrollment });

      // Get all resources for the module
      console.log(`[redeemCardForStudent] Getting resources for module ${moduleId}`);
      const resources = await getModuleResources({ moduleId });
      console.log(`[redeemCardForStudent] Resources found:`, {
        topics: resources.topics.length,
        exams: resources.exams.length,
        books: resources.books.length,
        topics_list: resources.topics,
        exams_list: resources.exams,
        books_list: resources.books
      });
      
      const allResourceIds = [
        ...resources.topics,
        ...resources.exams,
        ...resources.books,
      ];
      
      console.log(`[redeemCardForStudent] Total resource IDs to process:`, allResourceIds.length);

      for (const resourceId of allResourceIds) {
        try {
          const existing = await existingActiveSubscription({ studentId, resourceId });
          if (existing) {
            console.log(`[redeemCardForStudent] Resource ${resourceId} already has active subscription`);
            createdSubscriptions.push({
              subscription_id: existing.subscription_id,
              resource_id: resourceId,
              status: "already_active",
            });
            continue;
          }

          console.log(`[redeemCardForStudent] Creating subscription for resource ${resourceId}`);
          const inserted = await insertStudentSubscription({
            studentId,
            resourceId,
            cardId: card.card_id,
            endDate: card.end_date,
          });
          console.log(`[redeemCardForStudent] Subscription created:`, inserted);
          createdSubscriptions.push({ ...inserted, status: "created" });
        } catch (error) {
          console.error(`[redeemCardForStudent] Error creating subscription for resource ${resourceId}:`, error);
          createdSubscriptions.push({
            resource_id: resourceId,
            status: "error",
            error: error.message,
          });
        }
      }
      
      console.log(`[redeemCardForStudent] Total subscriptions processed:`, createdSubscriptions.length);
    }

    return { card, subscriptions: createdSubscriptions, enrollments };
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

