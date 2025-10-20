const { client } = require("../../config/db-connect");

async function listLibrariesByModule({
  moduleId,
  studentId,
  page = 1,
  limit = 12,
  search = "",
}) {
  const where = ["fl.status = 'active'", "fl.module_id = ?"];
  const params = [moduleId];
  if (search && search.trim()) {
    where.push("(fl.library_name LIKE ? OR fl.description LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  const sql = `
    SELECT fl.library_id, fl.library_name, fl.description, fl.difficulty_level,
           fl.estimated_time, fl.created_at,
           COUNT(f.flashcard_id) AS total_cards,
           COALESCE(slp.studied_count, 0) AS studied_count,
           COALESCE(slp.correct_count, 0) AS correct_count,
           COALESCE(slp.time_spent, 0) AS time_spent,
           COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE ${where.join(" AND ")}
    GROUP BY fl.library_id
    ORDER BY fl.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM flashcard_libraries fl
    WHERE ${where.join(" AND ")}
  `;
  const [rows] = await client.execute(sql, [
    studentId,
    ...params,
    limit,
    offset,
  ]);
  const [countRows] = await client.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;
  return {
    data: rows.map((r) => ({
      library_id: r.library_id,
      name: r.library_name,
      desc: r.description,
      difficulty: r.difficulty_level,
      estimated_time: r.estimated_time,
      created_at: r.created_at,
      total_cards: Number(r.total_cards) || 0,
      studied_count: Number(r.studied_count) || 0,
      correct_count: Number(r.correct_count) || 0,
      time_spent: Number(r.time_spent) || 0,
      progress_status: r.progress_status,
      progress_percent: Number(r.total_cards)
        ? Math.round((Number(r.studied_count) / Number(r.total_cards)) * 100)
        : 0,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
async function listLibrariesByBulkModules({
  moduleId,
  studentId,
  page = 1,
  limit = 1200,
  search = "",
}) {
  // Normalize moduleId to array
  let moduleIds = moduleId;
  if (!Array.isArray(moduleIds)) {
    if (typeof moduleIds === "string") {
      moduleIds = moduleIds.split(",").map((x) => x.trim()).filter(Boolean);
    } else if (moduleIds != null) {
      moduleIds = [moduleIds];
    } else {
      moduleIds = [];
    }
  }

  // if (moduleIds.length === 0) {
  //   // No modules → nothing to fetch
  //   return {
  //     data: [],
  //     page,
  //     limit,
  //     total: 0,
  //     totalPages: 0,
  //   };
  // }
  console.log(moduleIds)

  const placeholders = moduleIds.map(() => "?").join(",");
  const whereClauses = ["fl.status = 'active'", `fl.module_id IN (${placeholders})`];
  const paramsForWhere = [...moduleIds];

  if (search && search.trim()) {
    whereClauses.push("(fl.library_name LIKE ? OR fl.description LIKE ?)");
    paramsForWhere.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  const sql = `
    SELECT 
      fl.library_id, 
      fl.library_name, 
      fl.description, 
      fl.difficulty_level,
      fl.estimated_time, 
      fl.created_at,
      COUNT(f.flashcard_id) AS total_cards,
      COALESCE(slp.studied_count, 0) AS studied_count,
      COALESCE(slp.correct_count, 0) AS correct_count,
      COALESCE(slp.time_spent, 0) AS time_spent,
      COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY fl.library_id
    ORDER BY fl.created_at DESC
    LIMIT ? OFFSET ?;
  `;


  // Parameters must match the '?' positions in SQL:
  // 1st param = studentId (for the JOIN)
  // then moduleIds and optional search
  // then limit, offset
  const sqlParams = [studentId, ...paramsForWhere, limit, offset];

  // Debug log: to inspect final SQL and params
  console.log("listLibrariesByBulkModules: SQL:", sql);
  console.log("listLibrariesByBulkModules: params:", sqlParams);

  const [rows] = await client.execute(sql, sqlParams);

  // Count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM flashcard_libraries fl
    WHERE ${whereClauses.join(" AND ")};
  `;
  const [countRows] = await client.execute(countSql, paramsForWhere);
  const total = countRows?.[0]?.total ?? 0;

  const data = rows.map((r) => {
    const tc = Number(r.total_cards) || 0;
    const sc = Number(r.studied_count) || 0;
    return {
      library_id: r.library_id,
      name: r.library_name,
      desc: r.description,
      difficulty: r.difficulty_level,
      estimated_time: r.estimated_time,
      created_at: r.created_at,
      total_cards: tc,
      studied_count: sc,
      correct_count: Number(r.correct_count) || 0,
      time_spent: Number(r.time_spent) || 0,
      progress_status: r.progress_status,
      progress_percent: tc > 0 ? Math.round((sc / tc) * 100) : 0,
    };
  });

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}


async function getLibraryWithCards({ libraryId, studentId }) {
  const libSql = `
    SELECT fl.*, COUNT(f.flashcard_id) AS total_cards,
           COALESCE(slp.studied_count, 0) AS studied_count,
           COALESCE(slp.correct_count, 0) AS correct_count,
           COALESCE(slp.time_spent, 0) AS time_spent,
           COALESCE(slp.status, 'not_started') AS progress_status
    FROM flashcard_libraries fl
    LEFT JOIN flashcards f ON f.library_id = fl.library_id
    LEFT JOIN student_flashcard_library_progress slp
      ON slp.library_id = fl.library_id AND slp.student_id = ?
    WHERE fl.library_id = ?
    GROUP BY fl.library_id
  `;
  const [libRows] = await client.execute(libSql, [studentId, libraryId]);
  if (!libRows.length) return null;
  const lib = libRows[0];

  const cardsSql = `
    SELECT f.flashcard_id, f.front_text, f.back_text, f.difficulty_level, f.card_order,
           COALESCE(cp.attempts, 0) AS attempts,
           COALESCE(cp.correct, 0) AS correct,
           COALESCE(cp.status, 'new') AS card_status,
           cp.last_seen
    FROM flashcards f
    LEFT JOIN student_flashcard_card_progress cp
      ON cp.flashcard_id = f.flashcard_id AND cp.student_id = ?
    WHERE f.library_id = ? AND f.status IN ('active','draft')
    ORDER BY f.card_order, f.flashcard_id
  `;
  const [cardRows] = await client.execute(cardsSql, [studentId, libraryId]);

  return {
    library: {
      library_id: lib.library_id,
      name: lib.library_name,
      desc: lib.description,
      difficulty: lib.difficulty_level,
      estimated_time: lib.estimated_time,
      created_at: lib.created_at,
      total_cards: Number(lib.total_cards) || 0,
      studied_count: Number(lib.studied_count) || 0,
      correct_count: Number(lib.correct_count) || 0,
      time_spent: Number(lib.time_spent) || 0,
      progress_status: lib.progress_status,
      progress_percent: Number(lib.total_cards)
        ? Math.round(
            (Number(lib.studied_count) / Number(lib.total_cards)) * 100
          )
        : 0,
    },
    cards: cardRows,
  };
}

async function upsertLibraryProgress({
  studentId,
  libraryId,
  studiedCount,
  correctCount,
  timeSpent,
  status,
}) {
  const sql = `
    INSERT INTO student_flashcard_library_progress (student_id, library_id, studied_count, correct_count, time_spent, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      studied_count = VALUES(studied_count),
      correct_count = VALUES(correct_count),
      time_spent = VALUES(time_spent),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP
  `;
  await client.execute(sql, [
    studentId,
    libraryId,
    studiedCount,
    correctCount,
    timeSpent,
    status,
  ]);
  return true;
}

async function upsertCardProgress({
  studentId,
  flashcardId,
  attempts,
  correct,
  status,
}) {
  const sql = `
    INSERT INTO student_flashcard_card_progress (student_id, flashcard_id, attempts, correct, status, last_seen)
    VALUES (?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      attempts = attempts + VALUES(attempts),
      correct = correct + VALUES(correct),
      status = VALUES(status),
      last_seen = NOW()
  `;
  await client.execute(sql, [
    studentId,
    flashcardId,
    attempts,
    correct,
    status,
  ]);
  return true;
}

async function importAllLibrariesToDeck({ studentId, deckTitle = "Imported Flashcards", deckDescription = "All flashcard libraries imported to personal deck" }) {
  try {
    // First, create a new deck for the student
    const createDeckSql = `
      INSERT INTO student_deck (student_id, deck_title, deck_description)
      VALUES (?, ?, ?)
    `;
    const [deckResult] = await client.execute(createDeckSql, [studentId, deckTitle, deckDescription]);
    const deckId = deckResult.insertId;

    // Get all active flashcard libraries with their cards
    const librariesSql = `
      SELECT 
        fl.library_id,
        fl.library_name,
        fl.description,
        fl.difficulty_level,
        f.flashcard_id,
        f.front_text,
        f.back_text,
        f.difficulty_level as card_difficulty,
        f.card_order
      FROM flashcard_libraries fl
      LEFT JOIN flashcards f ON f.library_id = fl.library_id AND f.status IN ('active', 'draft')
      WHERE fl.status = 'active'
      ORDER BY fl.library_id, f.card_order, f.flashcard_id
    `;
    
    const [libraryRows] = await client.execute(librariesSql);
    
    if (libraryRows.length === 0) {
      return {
        success: false,
        message: "No active flashcard libraries found",
        deckId: null,
        importedLibraries: 0,
        importedCards: 0
      };
    }

    // Group cards by library
    const librariesMap = new Map();
    libraryRows.forEach(row => {
      if (!librariesMap.has(row.library_id)) {
        librariesMap.set(row.library_id, {
          library_id: row.library_id,
          library_name: row.library_name,
          description: row.description,
          difficulty_level: row.difficulty_level,
          cards: []
        });
      }
      
      if (row.flashcard_id) {
        librariesMap.get(row.library_id).cards.push({
          flashcard_id: row.flashcard_id,
          front_text: row.front_text,
          back_text: row.back_text,
          difficulty_level: row.card_difficulty,
          card_order: row.card_order
        });
      }
    });

    // Prepare batch insert for flashcards
    const cardsToInsert = [];
    let cardOrder = 1;
    
    librariesMap.forEach(library => {
      library.cards.forEach(card => {
        cardsToInsert.push([
          card.front_text,
          card.back_text,
          deckId,
          JSON.stringify({
            original_library_id: library.library_id,
            original_library_name: library.library_name,
            original_flashcard_id: card.flashcard_id,
            difficulty_level: card.difficulty_level || library.difficulty_level
          }),
          'not_seen',
          '0',
          card.difficulty_level || library.difficulty_level || 'medium',
          0, // question_id
          0, // qbank_id
          2.50, // ease_factor
          0, // repetitions
          0, // interval_days
          cardOrder++
        ]);
      });
    });

    if (cardsToInsert.length === 0) {
      return {
        success: false,
        message: "No flashcards found in active libraries",
        deckId: null,
        importedLibraries: 0,
        importedCards: 0
      };
    }

    // Batch insert all flashcards
    const insertCardsSql = `
      INSERT INTO student_flash_cards (
        student_flash_card_front,
        student_flash_card_back,
        deck_id,
        tags,
        card_status,
        card_solved,
        difficulty,
        question_id,
        qbank_id,
        ease_factor,
        repetitions,
        interval_days
      ) VALUES ?
    `;
    
    await client.execute(insertCardsSql, [cardsToInsert]);

    return {
      success: true,
      message: `Successfully imported ${librariesMap.size} libraries with ${cardsToInsert.length} flashcards`,
      deckId: deckId,
      importedLibraries: librariesMap.size,
      importedCards: cardsToInsert.length,
      libraries: Array.from(librariesMap.values()).map(lib => ({
        library_id: lib.library_id,
        library_name: lib.library_name,
        cards_count: lib.cards.length
      }))
    };

  } catch (error) {
    console.error("Error importing libraries to deck:", error);
    throw new Error(`Failed to import libraries: ${error.message}`);
  }
}

async function copyDeckById({ sourceDeckId, studentId, newDeckTitle, newDeckDescription }) {
  try {
    // First, get the source library information
    const getSourceLibrarySql = `
      SELECT 
        fl.library_id,
        fl.library_name,
        fl.description,
        fl.difficulty_level,
        fl.created_at,
        COUNT(f.flashcard_id) AS total_cards
      FROM flashcard_libraries fl
      LEFT JOIN flashcards f ON f.library_id = fl.library_id AND f.status IN ('active', 'draft')
      WHERE fl.library_id = ? AND fl.status = 'active'
      GROUP BY fl.library_id
    `;
    
    const [sourceLibraryRows] = await client.execute(getSourceLibrarySql, [sourceDeckId]);
    
    if (!sourceLibraryRows.length) {
      return {
        success: false,
        message: "Source library not found",
        newDeckId: null,
        copiedCards: 0
      };
    }
    
    const sourceLibrary = sourceLibraryRows[0];
    
    // Create a new deck for the student
    const createDeckSql = `
      INSERT INTO student_deck (student_id, deck_title, deck_description)
      VALUES (?, ?, ?)
    `;
    
    const deckTitle = newDeckTitle || `${sourceLibrary.library_name}`;
    const deckDescription = newDeckDescription || `"${sourceLibrary.library_name}"`;
    
    const [deckResult] = await client.execute(createDeckSql, [studentId, deckTitle, deckDescription]);
    const newDeckId = deckResult.insertId;
    
    // Get all flashcards from the source library
    const getSourceCardsSql = `
      SELECT 
        f.flashcard_id,
        f.front_text,
        f.back_text,
        f.difficulty_level,
        f.card_order,
        f.topic_id,
        f.library_id
      FROM flashcards f
      WHERE f.library_id = ? AND f.status IN ('active', 'draft')
      ORDER BY f.card_order, f.flashcard_id
    `;
    
    const [sourceCardsRows] = await client.execute(getSourceCardsSql, [sourceDeckId]);
    
    if (sourceCardsRows.length === 0) {
      return {
        success: true,
        message: `Library copied successfully but no flashcards found in source library`,
        newDeckId: newDeckId,
        copiedCards: 0,
        sourceLibrary: {
          library_id: sourceLibrary.library_id,
          library_name: sourceLibrary.library_name,
          total_cards: sourceLibrary.total_cards
        }
      };
    }
    
    // Prepare batch insert for flashcards
    const cardsToInsert = [];
    
    sourceCardsRows.forEach(card => {
      // Create tags with source information
      const tags = {
        copied_from_library_id: sourceLibrary.library_id,
        copied_from_library_name: sourceLibrary.library_name,
        original_flashcard_id: card.flashcard_id,
        copied_at: new Date().toISOString()
      };
      
      cardsToInsert.push([
        card.front_text,
        card.back_text,
        newDeckId,
        JSON.stringify(tags),
        'not_seen', // card_status
        '0', // card_solved
        card.difficulty_level || 'medium',
        0, // question_id
        0, // qbank_id
        2.50, // ease_factor
        0, // repetitions
        0 // interval_days
      ]);
    });
    
    // Batch insert all flashcards
    const insertCardsSql = `
      INSERT INTO student_flash_cards (
        student_flash_card_front,
        student_flash_card_back,
        deck_id,
        tags,
        card_status,
        card_solved,
        difficulty,
        question_id,
        qbank_id,
        ease_factor,
        repetitions,
        interval_days
      ) VALUES ?
    `;
    
    await client.execute(insertCardsSql, [cardsToInsert]);
    
    return {
      success: true,
      message: `Successfully copied library "${sourceLibrary.library_name}" with ${cardsToInsert.length} flashcards`,
      newDeckId: newDeckId,
      copiedCards: cardsToInsert.length,
      sourceLibrary: {
        library_id: sourceLibrary.library_id,
        library_name: sourceLibrary.library_name,
        total_cards: sourceLibrary.total_cards
      },
      newDeck: {
        deck_id: newDeckId,
        deck_title: deckTitle,
        deck_description: deckDescription
      }
    };
    
  } catch (error) {
    console.error("Error copying deck:", error);
    throw new Error(`Failed to copy deck: ${error.message}`);
  }
}

async function listAllLibraries({ search = "" }) {
  try {
    const where = ["fl.status = 'active'"];
    const params = [];
    
    if (search && search.trim()) {
      where.push("(fl.library_name LIKE ? OR fl.description LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    
    const sql = `
      SELECT 
        fl.library_id,
        fl.library_name,
        fl.description,
        fl.difficulty_level,
        fl.created_at,
        COUNT(f.flashcard_id) AS total_cards
      FROM flashcard_libraries fl
      LEFT JOIN flashcards f ON f.library_id = fl.library_id AND f.status IN ('active', 'draft')
      WHERE ${where.join(" AND ")}
      GROUP BY fl.library_id
      ORDER BY fl.created_at DESC
    `;
    
    const [rows] = await client.execute(sql, params);
    
    return {
      success: true,
      data: rows.map(row => ({
        library_id: row.library_id,
        library_name: row.library_name,
        description: row.description,
        difficulty_level: row.difficulty_level,
        created_at: row.created_at,
        total_cards: Number(row.total_cards) || 0
      }))
    };
    
  } catch (error) {
    console.error("Error listing libraries:", error);
    throw new Error(`Failed to list libraries: ${error.message}`);
  }
}

module.exports = {
  listLibrariesByModule,
  getLibraryWithCards,
  upsertLibraryProgress,
  upsertCardProgress,
  listLibrariesByBulkModules,
  importAllLibrariesToDeck,
  copyDeckById,
  listAllLibraries
};
