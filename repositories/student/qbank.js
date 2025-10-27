const { client } = require("../../config/db-connect");
const activityTracking = require("./activityTracking");

const solveQuestion = async ({ question_id, studentId, answer, qbank_id, correct }) => {
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
        `INSERT INTO solved_questions (question_id, student_id, answer, is_correct, qbank_id)
         VALUES (?, ?, ?, ?, ?)`,
        [question_id, studentId, answer, correct ? correct ? '1' : '0' : isCorrect ? '1' : '0', qbank_id ? qbank_id : 0]
    );

    // Log activity automatically
    try {
        await activityTracking.logActivity({
            studentId,
            activityType: "question_answered",
            activityDescription: `Answered question: ${question.question_text.substring(0, 50)}...`,
            moduleName: null, // Could be enhanced to get module info
            topicName: null, // Could be enhanced to get topic info
            scorePercentage: isCorrect ? 100 : 0,
            pointsEarned: isCorrect ? 10 : 0, // 10 points for correct, 0 for incorrect
            metadata: {
                question_id,
                answer,
                is_correct: isCorrect,
                question_type: question.question_type,
                difficulty_level: question.difficulty_level
            }
        });
    } catch (activityError) {
        console.error("Failed to log activity for question solve:", activityError);
        // Don't throw error - activity logging is not critical
    }

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

const fetchQuestionsByTopicIds = async (topicIds = [], filters = {}, studentId = null) => {
    if (!Array.isArray(topicIds) || topicIds.length === 0) return [];
    const placeholders = topicIds.map(() => '?').join(',');
    const numQuestions = filters?.numQuestions || 10;

    // First, get counts for each mode to determine distribution
    let countSql = `SELECT 
        COUNT(DISTINCT CASE WHEN sq.question_id IS NULL THEN q.question_id END) AS unused_count,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '0' THEN q.question_id END) AS incorrect_count,
        COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '1' THEN q.question_id END) AS correct_count,
        COUNT(DISTINCT CASE WHEN mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL THEN q.question_id END) AS marked_count
        FROM questions q`;

    if (studentId) {
        countSql += ` LEFT JOIN (
            SELECT DISTINCT question_id, is_correct 
            FROM solved_questions 
            WHERE student_id = ?
        ) sq ON q.question_id = sq.question_id`;
        countSql += ` LEFT JOIN mark_category_question mcq ON q.question_id = mcq.question_id`;
        countSql += ` LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?`;
    } else {
        countSql += ` LEFT JOIN solved_questions sq ON q.question_id = sq.question_id`;
        countSql += ` LEFT JOIN mark_category_question mcq ON q.question_id = mcq.question_id`;
        countSql += ` LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id`;
    }

    countSql += ` WHERE q.topic_id IN (${placeholders})`;

    if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        const difficultyPlaceholders = filters.status.map(() => '?').join(',');
        countSql += ` AND q.difficulty_level IN (${difficultyPlaceholders})`;
    }

    const countValues = studentId ? [studentId, studentId, ...topicIds] : [...topicIds];
    if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        countValues.push(...filters.status);
    }

    const [countRows] = await client.execute(countSql, countValues);
    const counts = countRows[0];

    // Determine which modes to include and how many questions from each
    const availableModes = [];
    if (filters.question_mode && Array.isArray(filters.question_mode) && filters.question_mode.length > 0) {
        filters.question_mode.forEach(mode => {
            const count = counts[`${mode}_count`] || 0;
            if (count > 0) {
                availableModes.push({ mode, count });
            }
        });
    } else {
        // If no mode specified, use all available modes
        if (counts.unused_count > 0) availableModes.push({ mode: 'unused', count: counts.unused_count });
        if (counts.incorrect_count > 0) availableModes.push({ mode: 'incorrect', count: counts.incorrect_count });
        if (counts.correct_count > 0) availableModes.push({ mode: 'correct', count: counts.correct_count });
        if (counts.marked_count > 0) availableModes.push({ mode: 'marked', count: counts.marked_count });
    }

    // Calculate questions per mode (distribute evenly, but respect individual mode limits)
    // First, check if total available questions is less than requested
    const totalAvailable = availableModes.reduce((sum, { count }) => sum + count, 0);
    const actualNumQuestions = Math.min(numQuestions, totalAvailable);

    // If we have multiple topics, try to distribute questions across topics as well
    let modeLimits = [];
    if (topicIds.length > 1) {
        // Distribute questions across topics first, then across modes within each topic
        const questionsPerTopic = Math.ceil(actualNumQuestions / topicIds.length);

        for (const topicId of topicIds) {
            const topicQuestionsPerMode = Math.ceil(questionsPerTopic / availableModes.length);

            availableModes.forEach(({ mode, count }) => {
                const limit = Math.min(topicQuestionsPerMode, count);
                if (limit > 0) {
                    modeLimits.push({ mode, limit, topicId });
                }
            });
        }
    } else {
        // Single topic - distribute across modes only
        const questionsPerMode = Math.ceil(actualNumQuestions / availableModes.length);
        modeLimits = availableModes.map(({ mode, count }) => ({
            mode,
            limit: Math.min(questionsPerMode, count),
            topicId: topicIds[0]
        }));
    }

    console.log('Available counts:', counts);
    console.log('Available modes:', availableModes);
    console.log('Requested questions:', numQuestions);
    console.log('Total available:', totalAvailable);
    console.log('Actual questions to fetch:', actualNumQuestions);
    console.log('Mode distribution:', modeLimits);

    // If no questions available, return empty result
    if (totalAvailable === 0) {
        console.log('No questions available for the specified criteria');
        return {
            questions: [],
            counts: {
                correct_count_easy: 0, correct_count_medium: 0, correct_count_hard: 0,
                wrong_count_easy: 0, wrong_count_medium: 0, wrong_count_hard: 0,
                unused_count_easy: 0, unused_count_medium: 0, unused_count_hard: 0,
                marked_count_easy: 0, marked_count_medium: 0, marked_count_hard: 0,
                total_questions: 0
            }
        };
    }

    // Now fetch questions based on calculated limits
    let allQuestions = [];
    let aggregatedCounts = {
        correct_count_easy: 0, correct_count_medium: 0, correct_count_hard: 0,
        wrong_count_easy: 0, wrong_count_medium: 0, wrong_count_hard: 0,
        unused_count_easy: 0, unused_count_medium: 0, unused_count_hard: 0,
        marked_count_easy: 0, marked_count_medium: 0, marked_count_hard: 0,
        total_questions: 0
    };

    for (const { mode, limit, topicId } of modeLimits) {
        if (limit <= 0) continue;

        let modeSql = `SELECT 
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
            ) AS options,
            CASE WHEN sq.question_id IS NOT NULL THEN 1 ELSE 0 END AS is_solved,
            CASE WHEN sq.is_correct = '1' THEN 1 ELSE 0 END AS is_correct_answer,
            CASE WHEN mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL THEN 1 ELSE 0 END AS is_marked,
            q.difficulty_level,
            -- Correct counts by difficulty
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '1' AND q.difficulty_level = 'easy' THEN 1 ELSE 0 END AS correct_count_easy,
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '1' AND q.difficulty_level = 'medium' THEN 1 ELSE 0 END AS correct_count_medium,
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '1' AND q.difficulty_level = 'hard' THEN 1 ELSE 0 END AS correct_count_hard,
            -- Wrong counts by difficulty
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '0' AND q.difficulty_level = 'easy' THEN 1 ELSE 0 END AS wrong_count_easy,
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '0' AND q.difficulty_level = 'medium' THEN 1 ELSE 0 END AS wrong_count_medium,
            CASE WHEN sq.question_id IS NOT NULL AND sq.is_correct = '0' AND q.difficulty_level = 'hard' THEN 1 ELSE 0 END AS wrong_count_hard,
            -- Unused counts by difficulty
            CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'easy' THEN 1 ELSE 0 END AS unused_count_easy,
            CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'medium' THEN 1 ELSE 0 END AS unused_count_medium,
            CASE WHEN sq.question_id IS NULL AND q.difficulty_level = 'hard' THEN 1 ELSE 0 END AS unused_count_hard,
            -- Marked counts by difficulty
            CASE WHEN mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL AND q.difficulty_level = 'easy' THEN 1 ELSE 0 END AS marked_count_easy,
            CASE WHEN mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL AND q.difficulty_level = 'medium' THEN 1 ELSE 0 END AS marked_count_medium,
            CASE WHEN mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL AND q.difficulty_level = 'hard' THEN 1 ELSE 0 END AS marked_count_hard
            FROM questions q
            LEFT JOIN question_options qo ON q.question_id = qo.question_id`;

        if (studentId) {
            modeSql += ` LEFT JOIN (
                SELECT DISTINCT question_id, is_correct 
                FROM solved_questions 
                WHERE student_id = ?
            ) sq ON q.question_id = sq.question_id`;
            modeSql += ` LEFT JOIN mark_category_question mcq ON q.question_id = mcq.question_id`;
            modeSql += ` LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id AND smc.student_id = ?`;
        } else {
            modeSql += ` LEFT JOIN solved_questions sq ON q.question_id = sq.question_id`;
            modeSql += ` LEFT JOIN mark_category_question mcq ON q.question_id = mcq.question_id`;
            modeSql += ` LEFT JOIN student_mark_categories smc ON mcq.category_id = smc.student_mark_category_id`;
        }

        modeSql += ` WHERE q.topic_id = ?`;

        const modeValues = studentId ? [studentId, studentId, topicId] : [topicId];

        if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
            const difficultyPlaceholders = filters.status.map(() => '?').join(',');
            modeSql += ` AND q.difficulty_level IN (${difficultyPlaceholders})`;
            modeValues.push(...filters.status);
        }

        // Add mode-specific condition
        switch (mode) {
            case 'unused':
                modeSql += ` AND sq.question_id IS NULL`;
                break;
            case 'incorrect':
                modeSql += ` AND (sq.question_id IS NOT NULL AND sq.is_correct = '0')`;
                break;
            case 'correct':
                modeSql += ` AND (sq.question_id IS NOT NULL AND sq.is_correct = '1')`;
                break;
            case 'marked':
                modeSql += ` AND (mcq.question_id IS NOT NULL AND smc.student_id IS NOT NULL)`;
                break;
        }

        modeSql += ` GROUP BY q.question_id ORDER BY q.created_at DESC LIMIT ?`;
        modeValues.push(limit);

        console.log(`Fetching ${limit} ${mode} questions from topic ${topicId}`);
        const [modeRows] = await client.execute(modeSql, modeValues);

        // Process questions and aggregate counts
        const processedQuestions = modeRows.map((q) => ({
            ...q,
            options: JSON.parse(q.options)?.filter(Boolean) || [],
            question_mode: mode
        }));

        allQuestions = allQuestions.concat(processedQuestions);

        // Aggregate counts
        modeRows.forEach(row => {
            aggregatedCounts.correct_count_easy += row.correct_count_easy;
            aggregatedCounts.correct_count_medium += row.correct_count_medium;
            aggregatedCounts.correct_count_hard += row.correct_count_hard;
            aggregatedCounts.wrong_count_easy += row.wrong_count_easy;
            aggregatedCounts.wrong_count_medium += row.wrong_count_medium;
            aggregatedCounts.wrong_count_hard += row.wrong_count_hard;
            aggregatedCounts.unused_count_easy += row.unused_count_easy;
            aggregatedCounts.unused_count_medium += row.unused_count_medium;
            aggregatedCounts.unused_count_hard += row.unused_count_hard;
            aggregatedCounts.marked_count_easy += row.marked_count_easy;
            aggregatedCounts.marked_count_medium += row.marked_count_medium;
            aggregatedCounts.marked_count_hard += row.marked_count_hard;
        });
    }

    aggregatedCounts.total_questions = allQuestions.length;

    return {
        questions: allQuestions,
        counts: aggregatedCounts
    };
}

const fetchModulesSubjectsTopicsQuestions = async ({ selected_modules = [], filters = {}, studentId = null }) => {

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

    const questions = await fetchQuestionsByTopicIds(topicIds, filters, studentId);
    console.log({ modules, subjects, topics, questions })
    return { modules, subjects, topics, questions: questions.questions, counts: questions.counts };
}

const createQbank = async ({ studentId, qbankName, tutorMode, timed, timeType, selected_modules,
    selected_subjects,
    selected_topics, question_level, numQuestions, question_mode = ["unused"] }) => {
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
        question_mode: question_mode,
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

const updateDeck = async ({ deckId, deck_title, deck_description }) => {
    let query = `UPDATE student_deck SET `;
    const params = [];
    const updates = [];

    if (deck_title !== undefined) {
        updates.push(`deck_title = ?`);
        params.push(deck_title);
    }

    if (deck_description !== undefined) {
        updates.push(`deck_description = ?`);
        params.push(deck_description || null);
    }

    if (updates.length === 0) {
        return false; // No fields to update
    }

    query += updates.join(', ') + ` WHERE student_deck_id = ?`;
    params.push(deckId);

    const [result] = await client.execute(query, params);
    return result.affectedRows > 0;
}

const deleteDeck = async ({ deckId }) => {
    const [result] = await client.execute(
        `DELETE FROM student_deck WHERE student_deck_id = ?`,
        [deckId]
    );
    return result.affectedRows > 0;
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
        top.*,
        unit.*,
        module.*,
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
         JSON_OBJECT(
         'is_correct', sq.is_correct,
         'answer', sq.answer

         ) AS your_answer,
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
	  LEFT JOIN topics top ON top.topic_id = q.topic_id
	  LEFT JOIN units unit ON unit.unit_id = top.unit_id
	  LEFT JOIN modules module ON module.module_id = unit.module_id
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
            const answerParsed = JSON.parse(r.your_answer);
            answerParsed.option_id =  r.options.find(option => option.option_text === answerParsed.answer)?.option_id;
            answerParsed.solved = false
            if (answerParsed?.is_correct != null) {
                answerParsed.solved = true
            }
            r.your_answer = answerParsed
            if (typeof r.flashcards === 'string') {
                const parsed = JSON.parse(r.flashcards).filter(Boolean);

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
    } else if (mode == "spaced-repetition") {
        where += ` AND (sfc.next_review IS NULL OR sfc.next_review <= NOW())`;
    } else {

        order = `ORDER BY sfc.created_at DESC`;
    }


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


const listQbanks = async ({ studentId, page = 1, limit = 20, search = "", status = "active" }) => {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT 
            q.*,
            COUNT(DISTINCT qq.question_id) AS question_count,
            COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END) AS solved_count,
            COUNT(DISTINCT CASE WHEN sq.is_correct = '1' THEN sq.question_id END) AS correct_count,
            CASE 
              WHEN COUNT(DISTINCT qq.question_id) = 0 THEN 0
              ELSE ROUND((COUNT(DISTINCT CASE WHEN sq.question_id IS NOT NULL THEN sq.question_id END) / COUNT(DISTINCT qq.question_id)) * 100, 0)
            END AS progress_percent,
            u.unit_name as subject_name,
            m.subject_name as module_name
        FROM qbank q
        LEFT JOIN qbank_questions qq ON q.qbank_id = qq.qbank_id
        LEFT JOIN questions qu ON qq.question_id = qu.question_id
        LEFT JOIN topics t ON qu.topic_id = t.topic_id
        LEFT JOIN units u ON t.unit_id = u.unit_id
        LEFT JOIN modules m ON u.module_id = m.module_id
        LEFT JOIN solved_questions sq 
          ON sq.qbank_id = q.qbank_id 
         AND sq.question_id = qq.question_id 
         AND sq.student_id = ?
        WHERE q.deleted = '0' AND q.student_id = ?
    `;

    let params = [studentId, studentId];

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


    let countSql = `SELECT COUNT(*) as total FROM qbank WHERE deleted = '0' AND student_id = ?`;
    let countParams = [studentId];

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


    const questions = rows.map(q => ({
        ...q,
        options: JSON.parse(q.options).filter(Boolean)
    }));


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



const getStudentExams = async ({ studentId, page = 1, limit = 20, search = "", status = "published", difficulty = "" }) => {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT 
            e.exam_id as id,
            e.title as name,
            e.scheduled_date,
            e.start_date,
            e.end_date,
            e.duration,
            e.difficulty,
            e.status,
            e.instructions,
            m.subject_name as subject_name,
            COUNT(eq.question_id) as questions,
            e.created_at
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
        WHERE e.status = ? 
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `;

    let params = [status, studentId];

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    sql += ` GROUP BY e.exam_id ORDER BY e.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await client.execute(sql, params);

    // Transform the data
    const transformedExams = rows.map(exam => transformExamData(exam));

    // Get total count
    let countSql = `
        SELECT COUNT(DISTINCT e.exam_id) as total 
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        WHERE e.status = ? 
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `;
    let countParams = [status, studentId];

    if (search) {
        countSql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        countSql += ` AND e.difficulty = ?`;
        countParams.push(difficulty);
    }

    const [countResult] = await client.execute(countSql, countParams);
    const total = countResult[0].total;

    return {
        exams: transformedExams,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get upcoming exams for student (scheduled or published)
const getUpcomingExams = async ({ studentId, page = 1, limit = 20, search = "", difficulty = "" }) => {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT 
            e.exam_id as id,
            e.title as name,
            e.scheduled_date,
            e.start_date,
            e.end_date,
            e.duration,
            e.difficulty,
            e.status,
            e.instructions,
            m.subject_name as subject_name,
            COUNT(eq.question_id) as questions,
            CASE WHEN er.student_id IS NULL THEN 0 ELSE 1 END AS is_registered,
            e.created_at
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
        LEFT JOIN exam_registrations er ON er.exam_id = e.exam_id AND er.student_id = ?
        WHERE e.status IN ('published', 'scheduled') 
        AND (e.scheduled_date > NOW() OR e.start_date > NOW() OR e.end_date > NOW())
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ?
        )
    `;

    let params = [studentId, studentId];

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    sql += ` GROUP BY e.exam_id ORDER BY e.scheduled_date ASC, e.start_date ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    console.log(sql, params)
    const [rows] = await client.execute(sql, params);

    // Transform the data
    const transformedExams = rows.map(exam => transformExamData(exam));

    // Get total count
    const total = await getExamCount(studentId, ['published', 'scheduled'], search, difficulty, true);

    return {
        exams: transformedExams,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get on-demand exams for student (published and available now)
const getOnDemandExams = async ({ studentId, page = 1, limit = 20, search = "", difficulty = "" }) => {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT 
            e.exam_id as id,
            e.title as name,
            e.scheduled_date,
            e.start_date,
            e.end_date,
            e.duration,
            e.difficulty,
            e.status,
            e.instructions,
            m.subject_name as subject_name,
            COUNT(eq.question_id) as questions,
            e.created_at
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
        WHERE e.status = 'published' 
        AND (e.scheduled_date IS NULL OR e.scheduled_date <= NOW())
        AND (e.end_date IS NULL OR e.end_date > NOW())
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? 
        )
    `;

    let params = [studentId];

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    sql += ` GROUP BY e.exam_id ORDER BY e.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await client.execute(sql, params);

    // Transform the data
    const transformedExams = rows.map(exam => transformExamData(exam));

    // Get total count
    const total = await getExamCount(studentId, ['published'], search, difficulty, false);

    return {
        exams: transformedExams,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Get past exam results for student
const getExamResults = async ({ studentId, page = 1, limit = 20, search = "", difficulty = "" }) => {
    const offset = (page - 1) * limit;

    let sql = `
        SELECT 
            e.exam_id as id,
            e.title as name,
            e.difficulty,
            m.subject_name as subject_name,
            COUNT(eq.question_id) as questions,
            ea.started_at,
            ea.submitted_at,
            ea.time_spent,
            ea.total_score,
            ea.status as attempt_status
        FROM exam_attempts ea
        INNER JOIN exams e ON ea.exam_id = e.exam_id
        LEFT JOIN modules m ON e.subject_id = m.module_id
        LEFT JOIN exam_questions eq ON e.exam_id = eq.exam_id
        WHERE ea.student_id = ? 
        AND ea.status = 'submitted'
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `;

    let params = [studentId, studentId];

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    sql += ` GROUP BY ea.exam_id, ea.started_at ORDER BY ea.submitted_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await client.execute(sql, params);

    // Transform the data for results
    const transformedResults = rows.map(result => {
        const examDate = result.submitted_at || result.started_at;
        const formattedDate = examDate ? new Date(examDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'TBD';

        const durationHours = result.time_spent ? Math.floor(result.time_spent / 3600) : 0;
        const durationMinutes = result.time_spent ? Math.floor((result.time_spent % 3600) / 60) : 0;
        const formattedDuration = durationHours > 0 ?
            `${durationHours}h ${durationMinutes}m` :
            `${durationMinutes}m`;

        // Calculate percentage score
        const totalQuestions = result.questions || 1;
        const percentage = Math.round((result.total_score / totalQuestions) * 100);

        return {
            id: result.id,
            name: result.name,
            date: formattedDate,
            score: `${percentage}%`,
            percentile: `${Math.min(percentage + 10, 99)}th`, // Mock percentile calculation
            correct: `${result.total_score}/${totalQuestions}`,
            duration: formattedDuration,
            difficulty: result.difficulty || 'Medium',
            subject_name: result.subject_name,
            attempt_status: result.attempt_status
        };
    });

    // Get total count
    const total = await getExamResultsCount(studentId, search, difficulty);

    return {
        results: transformedResults,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// Start an exam (create exam attempt)
const startExam = async ({ studentId, examId }) => {
    // Check if exam exists and student has access
    const examCheck = await client.execute(`
        SELECT e.exam_id, e.title, e.duration, e.status
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        WHERE e.exam_id = ? 
        AND e.status = 'published'
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `, [examId, studentId]);

    if (examCheck[0].length === 0) {
        throw new Error('Exam not found or access denied');
    }

    // Check if student already has an active attempt
    const activeAttempt = await client.execute(`
        SELECT exam_attempt_id FROM exam_attempts 
        WHERE exam_id = ? AND student_id = ? AND status = 'in_progress'
    `, [examId, studentId]);

    if (activeAttempt[0].length > 0) {
        return activeAttempt[0][0].exam_attempt_id; // Return existing attempt
    }

    // Create new exam attempt
    const [result] = await client.execute(`
        INSERT INTO exam_attempts (exam_id, student_id, status, started_at)
        VALUES (?, ?, 'in_progress', NOW())
    `, [examId, studentId]);

    return result.insertId;
};

// Submit exam answers
const submitExamAnswer = async ({ attemptId, examQuestionId, answerText, selectedOptionId, timeSpent }) => {
    // Check if answer already exists
    const existingAnswer = await client.execute(`
        SELECT exam_answer_id FROM exam_answers 
        WHERE attempt_id = ? AND exam_question_id = ?
    `, [attemptId, examQuestionId]);

    if (existingAnswer[0].length > 0) {
        // Update existing answer
        const [result] = await client.execute(`
            UPDATE exam_answers 
            SET answer_text = ?, selected_option_id = ?, time_spent = ?, answered_at = NOW()
            WHERE attempt_id = ? AND exam_question_id = ?
        `, [answerText, selectedOptionId, timeSpent, attemptId, examQuestionId]);

        return result.affectedRows > 0;
    } else {
        // Create new answer
        const [result] = await client.execute(`
            INSERT INTO exam_answers (attempt_id, exam_question_id, answer_text, selected_option_id, time_spent)
            VALUES (?, ?, ?, ?, ?)
        `, [attemptId, examQuestionId, answerText, selectedOptionId, timeSpent]);

        return result.affectedRows > 0;
    }
};

// Submit exam (complete attempt)
const submitExam = async ({ attemptId, studentId }) => {
    // Get all answers and calculate score
    const [answers] = await client.execute(`
        SELECT ea.*, qo.is_correct, eq.points
        FROM exam_answers ea
        INNER JOIN exam_questions eq ON ea.exam_question_id = eq.id
        LEFT JOIN question_options qo ON ea.selected_option_id = qo.option_id
        WHERE ea.attempt_id = ?
    `, [attemptId]);

    let totalScore = 0;
    let totalPoints = 0;

    // Update answers with correctness and points
    for (const answer of answers) {
        const isCorrect = answer.is_correct ? 1 : 0;
        const pointsEarned = isCorrect ? (answer.points || 1) : 0;

        totalScore += pointsEarned;
        totalPoints += (answer.points || 1);

        // Update answer record
        await client.execute(`
            UPDATE exam_answers 
            SET is_correct = ?, points_earned = ?
            WHERE exam_answer_id = ?
        `, [isCorrect, pointsEarned, answer.exam_answer_id]);
    }

    // Update attempt record
    const [result] = await client.execute(`
        UPDATE exam_attempts 
        SET status = 'submitted', submitted_at = NOW(), total_score = ?
        WHERE exam_attempt_id = ? AND student_id = ?
    `, [totalScore, attemptId, studentId]);

    return {
        success: result.affectedRows > 0,
        totalScore,
        totalPoints,
        percentage: Math.round((totalScore / totalPoints) * 100)
    };
};

// Get exam questions for a specific exam
const getExamQuestions = async ({ examId, studentId }) => {
    // Verify student has access to exam
    const examCheck = await client.execute(`
        SELECT e.exam_id, e.title, e.duration, e.instructions
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        WHERE e.exam_id = ? 
        AND e.status = 'published'
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `, [examId, studentId]);

    if (examCheck[0].length === 0) {
        throw new Error('Exam not found or access denied');
    }

    const exam = examCheck[0][0];

    // Get exam questions with options
    const [questions] = await client.execute(`
        SELECT 
            eq.id,
            eq.order_index,
            eq.points,
            q.question_id,
            q.question_text,
            q.question_type,
            q.difficulty_level,
            q.explanation,
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
        FROM exam_questions eq
        INNER JOIN questions q ON eq.question_id = q.question_id
        LEFT JOIN question_options qo ON q.question_id = qo.question_id
        WHERE eq.exam_id = ?
        GROUP BY eq.id, q.question_id
        ORDER BY eq.order_index
    `, [examId]);

    // Parse options for each question
    const questionsWithOptions = questions.map(q => ({
        ...q,
        options: JSON.parse(q.options).filter(Boolean)
    }));

    return {
        exam: {
            exam_id: exam.exam_id,
            title: exam.title,
            duration: exam.duration,
            instructions: exam.instructions,
            total_questions: questions.length
        },
        questions: questionsWithOptions
    };
};

// Register student for an exam (scheduled slot/metadata)
const registerForExam = async ({ studentId, examId, startSlot, notifications, notes, startISO, endISO }) => {
    // Ensure registration table exists (idempotent)


    const [result] = await client.execute(`
        INSERT INTO exam_registrations (exam_id, student_id, start_slot, notifications, notes, start_iso, end_iso)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          start_slot = VALUES(start_slot),
          notifications = VALUES(notifications),
          notes = VALUES(notes),
          start_iso = VALUES(start_iso),
          end_iso = VALUES(end_iso)`,
        [examId, studentId, startSlot || null, notifications ? JSON.stringify(notifications) : null, notes || null, startISO || null, endISO || null]
    );

    return { registered: true };
};

// Helper function to transform exam data
const transformExamData = (exam) => {
    // Format date
    const examDate = exam.scheduled_date || exam.start_date;
    const formattedDate = examDate ? new Date(examDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : 'TBD';

    // Format time
    const formattedTime = examDate ? new Date(examDate).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }) : 'TBD';

    // Format duration
    const durationHours = exam.duration ? Math.floor(exam.duration / 60) : 0;
    const durationMinutes = exam.duration ? exam.duration % 60 : 0;
    const formattedDuration = durationHours > 0 ?
        `${durationHours}h ${durationMinutes > 0 ? durationMinutes + 'm' : ''}`.trim() :
        `${durationMinutes}m`;

    // Get difficulty color
    const getDifficultyColor = (difficulty) => {
        switch (difficulty?.toLowerCase()) {
            case "easy":
                return "green";
            case "medium":
                return "yellow";
            case "hard":
                return "red";
            default:
                return "gray";
        }
    };

    return {
        id: exam.id,
        name: exam.name,
        date: formattedDate,
        time: formattedTime,
        duration: formattedDuration,
        questions: exam.questions || 0,
        registered: Number(exam.is_registered) || 0,
        difficulty: exam.difficulty || 'Medium',
        color: getDifficultyColor(exam.difficulty),
        type: "teacher", // Assuming all exams are created by teachers
        subject_name: exam.subject_name,
        status: exam.status,
        instructions: exam.instructions
    };
};

// Helper function to get exam count
const getExamCount = async (studentId, statuses, search, difficulty, upcomingOnly = false) => {
    let sql = `
        SELECT COUNT(DISTINCT e.exam_id) as total 
        FROM exams e
        LEFT JOIN modules m ON e.subject_id = m.module_id
        WHERE e.status IN (${statuses.map(() => '?').join(',')}) 
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `;

    let params = [...statuses, studentId];

    if (upcomingOnly) {
        sql += ` AND (e.scheduled_date > NOW() OR e.start_date > NOW() OR e.end_date > NOW())`;
    }

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    const [countResult] = await client.execute(sql, params);
    return countResult[0].total;
};

// Helper function to get exam results count
const getExamResultsCount = async (studentId, search, difficulty) => {
    let sql = `
        SELECT COUNT(DISTINCT ea.exam_attempt_id) as total 
        FROM exam_attempts ea
        INNER JOIN exams e ON ea.exam_id = e.exam_id
        LEFT JOIN modules m ON e.subject_id = m.module_id
        WHERE ea.student_id = ? 
        AND ea.status = 'submitted'
        AND m.module_id IN (
            SELECT se.module_id
            FROM student_enrollments se
            WHERE se.student_id = ? AND se.status = 'active'
        )
    `;

    let params = [studentId, studentId];

    if (search) {
        sql += ` AND (e.title LIKE ? OR e.instructions LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty) {
        sql += ` AND e.difficulty = ?`;
        params.push(difficulty);
    }

    const [countResult] = await client.execute(sql, params);
    return countResult[0].total;
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
    getAvailableQuestions,
    getStudentExams,
    getUpcomingExams,
    getOnDemandExams,
    getExamResults,
    startExam,
    submitExamAnswer,
    submitExam,
    getExamQuestions,
    registerForExam,
    updateDeck,
    deleteDeck
}