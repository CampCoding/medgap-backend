const { client } = require("../../config/db-connect");
const solveQuestion = async ({ question_id, studentId, answer }) => {
    let [question] = await client.execute(
        `SELECT 
            questions.*, 
            CONCAT('[', 
                   GROUP_CONCAT(
                       JSON_OBJECT(
                           'option_text', question_options.option_text,
                           'is_correct', question_options.is_correct,
                           'explanation', question_options.explanation
                       )
                       SEPARATOR ','
                   ), 
                   ']'
            ) AS options 
         FROM questions 
         LEFT JOIN question_options 
           ON questions.question_id = question_options.question_id 
         WHERE questions.question_id = ?
         GROUP BY questions.question_id`,
        [question_id]
    );
    question = question[0]
    const optionsJson = question?.options;
    question.options = optionsJson ? JSON.parse(optionsJson) : [];





    const correctAnswer = question.model_answer;
    const isCorrect = question.options.some(option => option.is_correct && option.option_text === answer) ? 1 : 0;



    const [insertQuestionAnswer] = await client.execute(
        `INSERT INTO solved_questions (question_id, student_id, answer, is_correct)
         VALUES (?, ?, ?, ?)`,
        [question_id, studentId, answer, isCorrect ? '1' : '0']
    );
    return insertQuestionAnswer.insertId;

}

/**CREATE TABLE `campcod3_medgap`.`qbank` (`qbank_id` INT NOT NULL AUTO_INCREMENT , `qbank_name` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP , `tutor_mode` ENUM('1','0','','') NOT NULL DEFAULT '0' , `timed` ENUM('0','1','','') NOT NULL DEFAULT '0' , `time_type` ENUM('extended','fast','challenging','none') NOT NULL DEFAULT 'none' , `active` ENUM('0','1','','') NOT NULL DEFAULT '1' , `deleted` ENUM('0','1','','') NOT NULL DEFAULT '0' , PRIMARY KEY (`qbank_id`)) ENGINE = InnoDB;
 * 
 * CREATE TABLE `campcod3_medgap`.`qbank_questions` (`qbank_question_id` INT NOT NULL AUTO_INCREMENT , `question_id` INT NOT NULL , `qbank_id` INT NOT NULL , `correct_option` INT NOT NULL , PRIMARY KEY (`qbank_question_id`)) ENGINE = InnoDB;

 */

const fetchModules = async (moduleIds = []) => {
    if (Array.isArray(moduleIds) && moduleIds.length > 0) {
        const placeholders = moduleIds.map(() => '?').join(',');
        const [rows] = await client.execute(
            `SELECT module_id, subject_name, subject_code, subject_color, status
			 FROM modules WHERE module_id IN (${placeholders})`,
            moduleIds
        );
        return rows;
    }
    const [rows] = await client.execute(
        `SELECT module_id, subject_name, subject_code, subject_color, status
		 FROM modules WHERE status = 'active' ORDER BY subject_name ASC`
    );
    return rows;
}

const fetchSubjectsFromUnitsByModuleIds = async (moduleIds = []) => {
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) return [];
    const placeholders = moduleIds.map(() => '?').join(',');
    const [rows] = await client.execute(
        `SELECT 
		  u.unit_id    AS subject_id,
		  u.unit_name  AS subject_name,
		  u.module_id  AS module_id,
		  u.status     AS status,
		  u.unit_order AS subject_order
		 FROM units u
		 WHERE u.module_id IN (${placeholders}) AND u.status = 'active'
		 ORDER BY u.unit_order ASC, u.created_at ASC`,
        moduleIds
    );

    return rows;
}

const fetchTopicsByModuleIds = async (moduleIds = []) => {
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) return [];
    const placeholders = moduleIds.map(() => '?').join(',');
    const [rows] = await client.execute(
        `SELECT t.*
		 FROM topics t
		 INNER JOIN units u ON t.unit_id = u.unit_id
		 WHERE u.module_id IN (${placeholders}) AND t.status = 'active'
		 ORDER BY t.topic_order ASC, t.created_at DESC`,
        moduleIds
    );
    return rows;
}


const fetchTopicsByUnitIds = async (unitIds = []) => {
    if (!Array.isArray(unitIds) || unitIds.length === 0) return [];
    const placeholders = unitIds.map(() => '?').join(',');
    const [rows] = await client.execute(
        `SELECT t.*
         FROM topics t
         WHERE t.unit_id IN (${placeholders}) AND t.status = 'active'
         ORDER BY t.topic_order ASC, t.created_at DESC`,
        unitIds
    );
    return rows;
}

const fetchQuestionsByTopicIds = async (topicIds = [], filters = {}) => {
    if (!Array.isArray(topicIds) || topicIds.length === 0) return [];
    const placeholders = topicIds.map(() => '?').join(',');

    let sql = `SELECT 
		q.*,
		COALESCE(
			JSON_ARRAYAGG(
				CASE WHEN qo.option_id IS NOT NULL THEN JSON_OBJECT(
					'option_id', qo.option_id,
					'option_text', qo.option_text,
					'is_correct', qo.is_correct,
					'explanation', qo.explanation
				) END
			), JSON_ARRAY()
		) AS options
	 FROM questions q
	 LEFT JOIN question_options qo ON q.question_id = qo.question_id
	 WHERE q.topic_id IN (${placeholders})`;
    const values = [...topicIds];
    if (filters.status) {
        sql += ` AND q.difficulty_level IN (?)`;
        values.push(filters.status?.join(","));
    }

    sql += ` GROUP BY q.question_id ORDER BY q.created_at DESC LIMIT ?`;
    values.push(filters?.numQuestions)
    const [rows] = await client.execute(sql, values);
    return rows.map((q) => ({ ...q, options: JSON.parse(q.options)?.filter(Boolean) || [] }));
}

const fetchModulesSubjectsTopicsQuestions = async ({ selected_modules = [], filters = {} }) => {

    const modules = await fetchModules(selected_modules);
    const moduleIds = modules.map(m => m.module_id);


    const selectedSubjects = Array.isArray(filters.selected_subjects) ? filters.selected_subjects : [];
    const subjects = selectedSubjects.length
        ? await fetchSubjectsFromUnitsByModuleIds(moduleIds.length ? moduleIds : [])
        : await fetchSubjectsFromUnitsByModuleIds(moduleIds);


    let topics = [];
    if (selectedSubjects.length) {
        topics = await fetchTopicsByUnitIds(selectedSubjects);
    } else {
        topics = await fetchTopicsByModuleIds(moduleIds);
    }


    const explicitTopicIds = Array.isArray(filters.selected_topics) ? filters.selected_topics : [];
    const topicIds = explicitTopicIds.length ? explicitTopicIds : topics.map(t => t.topic_id);

    const questions = await fetchQuestionsByTopicIds(topicIds, filters);
    return { modules, subjects, topics, questions };
}

const createQbank = async ({ studentId, qbankName, tutorMode, timed, timeType, selected_modules,
    selected_subjects,
    selected_topics, question_level, numQuestions }) => {
    /**
      numQuestions:null,
  question_mode:"",
  question_level:"",
  selected_modules:[],
  selected_subjects:[],
  selected_topics:[],
  question_level:[]
     */









    const filters = {
        selected_modules,
        selected_subjects,
        selected_topics,
        status: question_level,
        question_mode: ["unused"],
        numQuestions
    }




    const questions = await fetchModulesSubjectsTopicsQuestions({ studentId, filters })

    const [insertQbank] = await client.execute(
        `INSERT INTO qbank (qbank_name, tutor_mode, timed, time_type, active, deleted, student_id)
         VALUES (?, ?, ?, ?,?, ?,? )`,
        [qbankName ? qbankName : new Date(), tutorMode, timed, timeType, '1', '0', studentId]
    );
    const rows = (questions?.questions || []).map(q => [
        q.question_id,
        insertQbank.insertId,
        (q.options || []).find(o => ['1', 1, true].includes(o?.is_correct))?.option_text || '-'
    ]);

    if (rows.length) await client.execute(
        `INSERT INTO qbank_questions (question_id, qbank_id, correct_option) VALUES ${rows.map(() => '(?,?,?)').join(',')}`,
        rows.flat()
    );

    return insertQbank.insertId;
}
const createCategory = async ({ studentId, category_name }) => {
    const [insertCategory] = await client.query("INSERT INTO student_mark_categories(student_id, category_name) VALUES (?,?)", [studentId, category_name])

    return insertCategory.insertId;
}

const listCategories = async ({ studentId }) => {
    const [rows] = await client.execute(
        `SELECT * FROM student_mark_categories WHERE student_id = ? ORDER BY student_mark_category_id DESC`,
        [studentId]
    );
    return rows;
}

const createDeck = async ({ studentId, qbank_id, question_id, deck_title, deck_description }) => {
    const [result] = await client.execute(
        `INSERT INTO student_deck (student_id, deck_title, deck_description, created_at)
		 VALUES (?, ?, ?, NOW())`,
        [studentId, deck_title, deck_description || null]
    );
    return result.insertId;
}

const listDecks = async ({ studentId }) => {
    const [rows] = await client.execute(
        `SELECT 
            sd.*,
            COUNT(fc.student_flash_card_id) AS total_cards,
            SUM(CASE WHEN fc.card_solved = '1' THEN 1 ELSE 0 END) AS solved_cards,
            CASE 
              WHEN COUNT(fc.student_flash_card_id) = 0 THEN 0
              ELSE ROUND( (SUM(CASE WHEN fc.card_solved = '1' THEN 1 ELSE 0 END) / COUNT(fc.student_flash_card_id)) * 100, 0)
            END AS progress_percent
         FROM student_deck sd
         LEFT JOIN student_flash_cards fc ON fc.deck_id = sd.student_deck_id
         WHERE sd.student_id = ?
         GROUP BY sd.student_deck_id
         ORDER BY sd.created_at DESC`,
        [studentId]
    );
    return rows;
}

const createNote = async ({ studentId, question_id, qbank_id, note_text }) => {
    const [insertCategory] = await client.query("INSERT INTO question_notes(student_id, question_id, qbank_id, note_text) VALUES (?,?,?,?)", [studentId, question_id, qbank_id, note_text])

    return insertCategory.insertId;
}

const deleteNote = async ({ note_id }) => {
    const [deleteMark] = await client.query("DELETE FROM question_notes WHERE question_note_id = ? ", [note_id])

    return deleteMark.affectedRows;
}

const listNotes = async ({ studentId, qbank_id, question_id }) => {
    const [rows] = await client.execute(
        `SELECT *
         FROM question_notes
         WHERE student_id = ? AND qbank_id = ? AND question_id = ?
         ORDER BY question_note_id DESC`,
        [studentId, qbank_id, question_id]
    );
    return rows;
}


const assignToCategory = async ({ question_id, qbank_id, category_id }) => {
    const [insertCategory] = await client.query("INSERT INTO mark_category_question(question_id, qbank_id, category_id) VALUES (?,?,?)", [question_id, qbank_id, category_id])

    return insertCategory.insertId;
}

const unAssignFromCategory = async ({ mark_id }) => {
    const [deleteMark] = await client.query("DELETE FROM mark_category_question WHERE 	mark_category_question_id = ? ", [mark_id])

    return deleteMark.affectedRows;
}

const listQuestion = async ({ qbank_id, studentId }) => {
    console.log(studentId)
    const [categories] = await client.query("SELECT * FROM student_mark_categories WHERE student_id = ?", [studentId])
    const [rows] = await client.query(
        `SELECT 
		sq.solved_question_id,
		qq.qbank_id,
		mcq.mark_category_question_id AS marked,
		mcq.category_id,
		smc.*,
		q.*,
		 COALESCE(
		  JSON_ARRAYAGG(
			CASE WHEN notes.question_note_id IS NOT NULL THEN JSON_OBJECT(
			  'note_id', notes.question_note_id,
			  'note_text', notes.note_text
			) END
			ORDER BY notes.question_note_id
		  ),
		  JSON_ARRAY()
		) AS notes,
		COALESCE(
		  JSON_ARRAYAGG(
			CASE WHEN qo.option_id IS NOT NULL THEN JSON_OBJECT(
			  'option_id', qo.option_id,
			  'option_text', qo.option_text,
			  'is_correct', qo.is_correct,
			  'explanation', qo.explanation
			) END
			ORDER BY qo.option_id
		  ),
		  JSON_ARRAY()
		) AS options,
		COALESCE(
		  JSON_ARRAYAGG(
			DISTINCT CASE WHEN sfc.student_flash_card_id IS NOT NULL THEN  JSON_OBJECT(
			  'student_flash_card_id', sfc.student_flash_card_id,
			  'deck_id', sfc.deck_id,
			  'front', sfc.student_flash_card_front,
			  'back', sfc.student_flash_card_back,
			  'tags', sfc.tags,
			  'card_status', sfc.card_status,
			  'card_solved', sfc.card_solved,
			  'difficulty', sfc.difficulty,
			  'ease_factor', sfc.ease_factor,
			  'repetitions', sfc.repetitions,
			  'interval_days', sfc.interval_days,
			  'last_reviewed', sfc.last_reviewed,
			  'next_review', sfc.next_review
			) END
			-- ordering inside JSON_ARRAYAGG may not be supported on MariaDB; omit for compatibility
		  ),
		  JSON_ARRAY()
		) AS flashcards
	  FROM qbank_questions qq
	  JOIN questions q ON q.question_id = qq.question_id
	  LEFT JOIN question_options qo ON qo.question_id = q.question_id
	  LEFT JOIN mark_category_question mcq ON mcq.question_id = q.question_id AND mcq.qbank_id = qq.qbank_id
	  LEFT JOIN student_mark_categories smc ON smc.student_mark_category_id = mcq.category_id
	  
	  LEFT JOIN solved_questions sq
		ON sq.qbank_id = qq.qbank_id
	   AND sq.question_id = q.question_id
	   AND sq.student_id = ?
	  LEFT JOIN question_notes notes ON notes.question_id = sq.question_id AND sq.qbank_id = notes.qbank_id
	  LEFT JOIN student_flash_cards sfc ON sfc.question_id = q.question_id AND sfc.qbank_id = qq.qbank_id
	  WHERE qq.qbank_id = ?
	  GROUP BY q.question_id, qq.qbank_id
	  ORDER BY q.question_id
	  `,
        [studentId, qbank_id]
    );

    for (const r of rows) {
        try {
            r.options = JSON.parse(r.options).filter(Boolean);
            if (typeof r.keywords === 'string') r.keywords = JSON.parse(r.keywords).filter(Boolean);
            if (typeof r.notes === 'string') r.notes = JSON.parse(r.notes).filter(Boolean);
            if (typeof r.flashcards === 'string') {
                const parsed = JSON.parse(r.flashcards).filter(Boolean);
                // parse tags nested JSON string if needed
                for (const fc of parsed) {
                    if (typeof fc.tags === 'string') {
                        try { fc.tags = JSON.parse(fc.tags); } catch { }
                    }
                }
                r.flashcards = parsed;
            }
            if (typeof r.tags === 'string') r.tags = JSON.parse(r.tags).filter(Boolean);
        } catch { }
    }
    return { questions: rows, categories };
};


const createFlashCard = async ({ deck_id, front, back, tags = [], difficulty = 'medium', question_id = 0, qbank_id = 0 }) => {
    const [res] = await client.execute(
        `INSERT INTO student_flash_cards (student_flash_card_front, student_flash_card_back, deck_id, tags, card_status, card_solved, created_at, solved_at, difficulty, question_id, qbank_id)
          VALUES (?, ?, ?, ?, 'not_seen', '0', NOW(), NULL, ?, ?, ?)`
        , [front, back, deck_id, JSON.stringify(tags), difficulty, question_id, qbank_id]
    );
    return res.insertId;
}

const updateFlashCard = async ({ student_flash_card_id, front, back, tags, card_status, card_solved, solved_at, difficulty }) => {
    const fields = [];
    const values = [];
    if (front !== undefined) { fields.push('student_flash_card_front = ?'); values.push(front); }
    if (back !== undefined) { fields.push('student_flash_card_back = ?'); values.push(back); }
    if (tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (card_status !== undefined) { fields.push('card_status = ?'); values.push(card_status); }
    if (card_solved !== undefined) { fields.push("card_solved = ?"); values.push(card_solved ? '1' : '0'); }
    if (solved_at !== undefined) { fields.push('solved_at = ?'); values.push(solved_at || null); }
    if (difficulty !== undefined) { fields.push('difficulty = ?'); values.push(difficulty); }
    if (!fields.length) return 0;
    values.push(student_flash_card_id);
    const [res] = await client.execute(`UPDATE student_flash_cards SET ${fields.join(', ')} WHERE student_flash_card_id = ?`, values);
    return res.affectedRows;
}

const deleteFlashCard = async ({ student_flash_card_id }) => {
    const [res] = await client.execute(`DELETE FROM student_flash_cards WHERE student_flash_card_id = ?`, [student_flash_card_id]);
    return res.affectedRows;
}

const listFlashcardsByDeck = async ({ studentId, deck_id }) => {
    const [rows] = await client.execute(
        `SELECT sfc.*
         FROM student_flash_cards sfc
         INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
         WHERE sd.student_id = ? AND sfc.deck_id = ?
         ORDER BY sfc.created_at DESC`,
        [studentId, deck_id]
    );
    for (const r of rows) {
        try { if (typeof r.tags === 'string') r.tags = JSON.parse(r.tags).filter(Boolean); } catch { }
    }
    return rows;
}


const getFlashcardsByMode = async ({ studentId, mode = 'repetition', limit = 20, deckId }) => {
    let where = `sd.student_id = ?`;
    let order = `ORDER BY COALESCE(sfc.next_review, sfc.created_at) ASC`;
    const values = [studentId];

    if (mode === 'new') {
        where += ` AND sfc.card_solved = '0'`;
        order = `ORDER BY sfc.created_at DESC`;
    } else if (mode === 'used') {
        where += ` AND sfc.card_solved = '1'`;
        order = `ORDER BY (sfc.last_reviewed IS NULL), sfc.last_reviewed DESC`;
    } else if(mode == "spaced-repetition") {
        where += ` AND (sfc.next_review IS NULL OR sfc.next_review <= NOW())`;
    }else{
        
        order = `ORDER BY sfc.created_at DESC`;
    }

    // optional deck filter
    if (deckId) {
        where += ` AND sfc.deck_id = ?`;
        values.push(deckId);
    }

    const sql = `SELECT sfc.*
          FROM student_flash_cards sfc
          INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
          WHERE ${where}
          ${order}
          LIMIT ?`;
    values.push(Number(limit) || 20);

    const [rows] = await client.execute(sql, values);
    for (const r of rows) {
        try { if (typeof r.tags === 'string') r.tags = JSON.parse(r.tags).filter(Boolean); } catch { }
    }
    return rows;
}

const reviewFlashcard = async ({ studentId, student_flash_card_id, quality, correct }) => {

    let q;
    if (quality !== undefined && quality !== null && quality !== "") {
        q = Math.max(0, Math.min(5, Number(quality)));
    } else if (correct !== undefined && correct !== null) {
        q = (correct === true || correct === 1 || correct === '1') ? 4 : 2;
    } else {

        q = 3;
    }

    const [cards] = await client.execute(
        `SELECT sfc.*
            , COALESCE(sfc.ease_factor, 2.5) AS ef
            , COALESCE(sfc.repetitions, 0)   AS reps
            , COALESCE(sfc.interval_days, 0) AS interval_days
          FROM student_flash_cards sfc
          INNER JOIN student_deck sd ON sd.student_deck_id = sfc.deck_id
          WHERE sfc.student_flash_card_id = ? AND sd.student_id = ?
          LIMIT 1`,
        [student_flash_card_id, studentId]
    );
    if (!cards || cards.length === 0) return null;
    const card = cards[0];

    let easeFactor = Number(card.ef) || 2.5;
    let repetitions = Number(card.reps) || 0;
    let intervalDays = Number(card.interval_days) || 0;

    let useHours = false;
    let intervalHours = 0;
    if (q < 3) {
        repetitions = 0;

        useHours = true;
        intervalHours = 6;
        intervalDays = 0;
    } else {
        // Short initial schedule: 1d, 2d, 4d for first three successful reviews
        if (repetitions === 0) intervalDays = 1;
        else if (repetitions === 1) intervalDays = 2;
        else if (repetitions === 2) intervalDays = 4;
        else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
        repetitions += 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const status = q >= 3 ? 'seen' : 'not_seen';
    const solved = q >= 4 ? '1' : (card.card_solved || '0');

    // Compute JS timestamps instead of using MySQL NOW()/DATE_ADD
    const now = new Date();
    const nextReview = useHours
        ? new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
        : new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    const [res] = await client.execute(
        `UPDATE student_flash_cards
         SET ease_factor = ?, repetitions = ?, interval_days = ?,
             last_reviewed = ?, next_review = ?,
             card_status = ?, card_solved = ?
         WHERE student_flash_card_id = ?`,
        [easeFactor, repetitions, intervalDays, now, nextReview, status, '1', student_flash_card_id]
    );
    return res.affectedRows > 0 ? (
        useHours ? {
            next_review_in: intervalHours,
            unit: 'hours',
            ease_factor: easeFactor,
            repetitions
        } : {
            next_review_in: intervalDays,
            unit: 'days',
            ease_factor: easeFactor,
            repetitions
        }
    ) : null;
}

// List qbanks for teachers
const listQbanks = async ({ teacherId, page = 1, limit = 20, search = "", status = "active" }) => {
    const offset = (page - 1) * limit;
    
    let sql = `
        SELECT 
            q.*,
            COUNT(qq.question_id) as question_count,
            u.unit_name as subject_name,
            m.subject_name as module_name
        FROM qbank q
        LEFT JOIN qbank_questions qq ON q.qbank_id = qq.qbank_id
        LEFT JOIN questions qu ON qq.question_id = qu.question_id
        LEFT JOIN topics t ON qu.topic_id = t.topic_id
        LEFT JOIN units u ON t.unit_id = u.unit_id
        LEFT JOIN modules m ON u.module_id = m.module_id
        WHERE q.deleted = '0'
    `;
    
    let params = [];
    
    if (search) {
        sql += ` AND q.qbank_name LIKE ?`;
        params.push(`%${search}%`);
    }
    
    if (status) {
        sql += ` AND q.active = ?`;
        params.push(status === 'active' ? '1' : '0');
    }
    
    sql += ` GROUP BY q.qbank_id ORDER BY q.qbank_id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const [rows] = await client.execute(sql, params);
    
    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM qbank WHERE deleted = '0'`;
    let countParams = [];
    
    if (search) {
        countSql += ` AND qbank_name LIKE ?`;
        countParams.push(`%${search}%`);
    }
    
    if (status) {
        countSql += ` AND active = ?`;
        countParams.push(status === 'active' ? '1' : '0');
    }
    
    const [countResult] = await client.execute(countSql, countParams);
    const total = countResult[0].total;
    
    return {
        qbanks: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get available questions for exam selection
const getAvailableQuestions = async ({ page = 1, limit = 50, search = "", subject = "", topic = "", difficulty = "", question_type = "", status = "active" }) => {
    const offset = (page - 1) * limit;
    
    let sql = `
        SELECT 
            q.*,
            t.topic_name,
            u.unit_name,
            m.subject_name as module_name,
            COALESCE(
                JSON_ARRAYAGG(
                    CASE WHEN qo.option_id IS NOT NULL THEN JSON_OBJECT(
                        'option_id', qo.option_id,
                        'option_text', qo.option_text,
                        'is_correct', qo.is_correct,
                        'explanation', qo.explanation
                    ) END
                ), JSON_ARRAY()
            ) AS options
        FROM questions q
        LEFT JOIN question_options qo ON q.question_id = qo.question_id
        LEFT JOIN topics t ON q.topic_id = t.topic_id
        LEFT JOIN units u ON t.unit_id = u.unit_id
        LEFT JOIN modules m ON u.module_id = m.module_id
        WHERE q.status = ?
    `;
    
    let params = [status];
    
    if (search) {
        sql += ` AND (q.question_text LIKE ? OR q.model_answer LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (subject) {
        sql += ` AND m.module_id = ?`;
        params.push(subject);
    }
    
    if (topic) {
        sql += ` AND t.topic_id = ?`;
        params.push(topic);
    }
    
    if (difficulty) {
        sql += ` AND q.difficulty_level = ?`;
        params.push(difficulty);
    }
    
    if (question_type) {
        sql += ` AND q.question_type = ?`;
        params.push(question_type);
    }
    
    sql += ` GROUP BY q.question_id ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const [rows] = await client.execute(sql, params);
    
    // Parse options for each question
    const questions = rows.map(q => ({
        ...q,
        options: JSON.parse(q.options).filter(Boolean)
    }));
    
    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM questions q
        LEFT JOIN topics t ON q.topic_id = t.topic_id
        LEFT JOIN units u ON t.unit_id = u.unit_id
        LEFT JOIN modules m ON u.module_id = m.module_id
        WHERE q.status = ?`;
    let countParams = [status];
    
    if (search) {
        countSql += ` AND (q.question_text LIKE ? OR q.model_answer LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (subject) {
        countSql += ` AND m.module_id = ?`;
        countParams.push(subject);
    }
    
    if (topic) {
        countSql += ` AND t.topic_id = ?`;
        countParams.push(topic);
    }
    
    if (difficulty) {
        countSql += ` AND q.difficulty_level = ?`;
        countParams.push(difficulty);
    }
    
    if (question_type) {
        countSql += ` AND q.question_type = ?`;
        countParams.push(question_type);
    }
    
    const [countResult] = await client.execute(countSql, countParams);
    const total = countResult[0].total;
    
    return {
        questions,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};


module.exports = {
    solveQuestion,
    createQbank,
    fetchModules,
    fetchSubjectsFromUnitsByModuleIds,
    fetchTopicsByModuleIds,
    fetchTopicsByUnitIds,
    fetchQuestionsByTopicIds,
    fetchModulesSubjectsTopicsQuestions,
    listQuestion,
    createCategory,
    listCategories,
    assignToCategory,
    unAssignFromCategory,
    createNote,
    deleteNote,
    listNotes,
    createDeck,
    listDecks,
    createFlashCard,
    updateFlashCard,
    deleteFlashCard,
    listFlashcardsByDeck,
    getFlashcardsByMode,
    reviewFlashcard,
    listQbanks,
    getAvailableQuestions
}
