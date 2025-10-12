const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/qbank");
const getTokenFromHeader = require("../../utils/getToken");
const { verifyAccessToken } = require("../../utils/jwt");

function getStudentId(req, res) {
    try {
        const token = getTokenFromHeader(req, res);
        if (!token) return null;
        const decoded = verifyAccessToken(token, "student");
        return decoded?.id || decoded?.student_id || decoded?.user?.student_id;
    } catch (err) {
        return null;
    }
}

async function solveQuestion(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { question_id, answer } = req.body;
    console.log("studentId", studentId)
    const question = await repo.solveQuestion({ question_id, studentId, answer });
    return responseBuilder.success(res, { question });
}

async function listQuestion(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { qbank_id } = req.params;
    const data = await repo.listQuestion({ qbank_id, studentId });
    return responseBuilder.success(res, { data });
}

async function assignToCategory(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { question_id, qbank_id, category_id } = req.body;
    try {
        const data = await repo.assignToCategory({ question_id, qbank_id, category_id });
        return responseBuilder.success(res, { data });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function unAssignFromCategory(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { mark_id } = req.body;
    try {
        const data = await repo.unAssignFromCategory({ mark_id });
        return responseBuilder.success(res, { data });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function deleteNote(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { note_id } = req.body;
    try {
        const data = await repo.deleteNote({ note_id });
        return responseBuilder.success(res, data);
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function createCategory(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { category_name } = req.body;
    try {
        const data = await repo.createCategory({ category_name, studentId });
        return responseBuilder.success(res, { data });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function listCategories(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    try {
        const categories = await repo.listCategories({ studentId });
        return responseBuilder.success(res, { categories });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function createNote(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { question_id, qbank_id, note_text } = req.body;
    try {
        const data = await repo.createNote({ studentId, question_id, qbank_id, note_text });
        return responseBuilder.success(res, { data });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function listNotes(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { qbank_id, question_id } = req.query;
    try {
        const notes = await repo.listNotes({ studentId, qbank_id, question_id });
        return responseBuilder.success(res, { notes });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function createDeck(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { deck_title, deck_description, qbank_id, question_id } = req.body;
    try {
        const deck_id = await repo.createDeck({ studentId, qbank_id, question_id, deck_title, deck_description });
        return responseBuilder.success(res, { deck_id });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function listDecks(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    try {
        const decks = await repo.listDecks({ studentId });
        return responseBuilder.success(res, { decks });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function listFlashcardsByDeck(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { deck_id } = req.params;
    try {
        const cards = await repo.listFlashcardsByDeck({ studentId, deck_id });
        return responseBuilder.success(res, { cards });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}
async function createQbankController(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    /**
     *   quiz_name:"",
    tutorMode:1 ,// study else exam,
    timeAcc :"standard", // "extended - fast - challenging" ,
     */
    const { tutorMode: tutorMode, timed: timed, timeAcc: timeType, selected_modules,
        selected_subjects,
        selected_topics, question_level, numQuestions } = req.body;
        const qbankName = req?.body?.quiz_name || new Date().toLocaleDateString();
    const qbank_id = await repo.createQbank({
        qbankName,
        tutorMode,
        timed,
        timeType,
        qbankName,
        studentId,
        selected_modules,
        selected_subjects,
        selected_topics,
        question_level,
        numQuestions
    });
    return responseBuilder.success(res, { qbank_id });
}

async function createFlashCard(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { deck_id, student_flash_card_front: front, student_flash_card_back: back, tags, difficulty, question_id, qbank_id } = req.body;
    try {
        const id = await repo.createFlashCard({ deck_id, front, back, tags, difficulty, question_id, qbank_id });
        return responseBuilder.success(res, { student_flash_card_id: id });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function updateFlashCard(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { student_flash_card_id } = req.params;
    const { student_flash_card_front: front, student_flash_card_back: back, tags, card_status, card_solved, solved_at, difficulty } = req.body;
    try {
        const affected = await repo.updateFlashCard({ student_flash_card_id, front, back, tags, card_status, card_solved, solved_at, difficulty });
        return responseBuilder.success(res, { affected });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function deleteFlashCard(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { student_flash_card_id } = req.params;
    try {
        const affected = await repo.deleteFlashCard({ student_flash_card_id });
        return responseBuilder.success(res, { affected });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function listDueFlashcards(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { limit, mode, deckId } = req.query;
    try {
        const cards = await repo.getFlashcardsByMode({ studentId, limit, mode, deckId });
        return responseBuilder.success(res, { cards });
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function reviewFlashcard(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { student_flash_card_id } = req.params;
    const { quality, correct } = req.body; // either quality 0..5 or correct boolean
    try {
        const result = await repo.reviewFlashcard({ studentId, student_flash_card_id, quality, correct });
        if (!result) return responseBuilder.badRequest(res, 'Card not found');
        return responseBuilder.success(res, result);
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

module.exports = {
    solveQuestion,
    createQbankController,
    listQuestion,
    createCategory,
    listCategories,
    assignToCategory,
    unAssignFromCategory,
    createNote,
    listNotes,
    deleteNote,
    createDeck,
    listDecks,
    createFlashCard,
    updateFlashCard,
    deleteFlashCard,
    listDueFlashcards,
    reviewFlashcard,
    listFlashcardsByDeck,
    
}