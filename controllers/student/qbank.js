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
    const { question_id, answer, qbank_id, correct } = req.body;
    console.log("studentId", studentId)
    const question = await repo.solveQuestion({ question_id, studentId, answer, qbank_id, correct });
    return responseBuilder.success(res, { question });
}

async function listQuestion(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { qbank_id } = req.params;
    const data = await repo.listQuestion({ qbank_id, studentId });
    return responseBuilder.success(res, { data });
}


async function listQbank(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const data = await repo.listQbanks({ studentId });
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

async function updateDeck(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { deck_id, deck_title, deck_description } = req.body;
    
    if (!deck_id) {
        return responseBuilder.badRequest(res, "Deck ID is required");
    }
    
    try {
        const success = await repo.updateDeck({ deckId: deck_id, deck_title, deck_description });
        if (success) {
            return responseBuilder.success(res, { message: "Deck updated successfully" });
        } else {
            return responseBuilder.notFound(res, "Deck not found or no changes made");
        }
    } catch (err) {
        return responseBuilder.badRequest(res, err.message);
    }
}

async function deleteDeck(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    const { deck_id } = req.body;
    
    if (!deck_id) {
        return responseBuilder.badRequest(res, "Deck ID is required");
    }
    
    try {
        const success = await repo.deleteDeck({ deckId: deck_id });
        if (success) {
            return responseBuilder.success(res, { message: "Deck deleted successfully" });
        } else {
            return responseBuilder.notFound(res, "Deck not found");
        }
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

async function getStudentExams(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { page = 1, limit = 20, search = "", status = "published", difficulty = "" } = req.query;
    
    try {
        const result = await repo.getStudentExams({ 
            studentId, 
            page: parseInt(page), 
            limit: parseInt(limit), 
            search, 
            status, 
            difficulty 
        });
        
        // Return data in the same format as your frontend expects
        return responseBuilder.success(res, { 
            data: result.exams, 
            pagination: result.pagination,
            message: "Student exams retrieved successfully" 
        });
    } catch (err) {
        console.error("Get student exams error:", err);
        return responseBuilder.serverError(res, "Failed to retrieve student exams");
    }
}

async function getUpcomingExams(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { page = 1, limit = 20, search = "", difficulty = "" } = req.query;
    
    try {
        const result = await repo.getUpcomingExams({ 
            studentId, 
            page: parseInt(page), 
            limit: parseInt(limit), 
            search, 
            difficulty 
        });
        
        return responseBuilder.success(res, { 
            data: result.exams, 
            pagination: result.pagination,
            message: "Upcoming exams retrieved successfully" 
        });
    } catch (err) {
        console.error("Get upcoming exams error:", err);
        return responseBuilder.serverError(res, "Failed to retrieve upcoming exams");
    }
}

async function getOnDemandExams(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { page = 1, limit = 20, search = "", difficulty = "" } = req.query;
    
    try {
        const result = await repo.getOnDemandExams({ 
            studentId, 
            page: parseInt(page), 
            limit: parseInt(limit), 
            search, 
            difficulty 
        });
        
        return responseBuilder.success(res, { 
            data: result.exams, 
            pagination: result.pagination,
            message: "On-demand exams retrieved successfully" 
        });
    } catch (err) {
        console.error("Get on-demand exams error:", err);
        return responseBuilder.serverError(res, "Failed to retrieve on-demand exams");
    }
}

async function getExamResults(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { page = 1, limit = 20, search = "", difficulty = "" } = req.query;
    
    try {
        const result = await repo.getExamResults({ 
            studentId, 
            page: parseInt(page), 
            limit: parseInt(limit), 
            search, 
            difficulty 
        });
        
        return responseBuilder.success(res, { 
            data: result.results, 
            pagination: result.pagination,
            message: "Exam results retrieved successfully" 
        });
    } catch (err) {
        console.error("Get exam results error:", err);
        return responseBuilder.serverError(res, "Failed to retrieve exam results");
    }
}

async function startExamAttempt(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { examId } = req.params;
    
    try {
        const attemptId = await repo.startExam({ studentId, examId });
        return responseBuilder.success(res, { 
            attemptId,
            message: "Exam started successfully" 
        });
    } catch (err) {
        console.error("Start exam error:", err);
        return responseBuilder.badRequest(res, err.message);
    }
}

async function submitExamAnswer(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { attemptId, examQuestionId, answerText, selectedOptionId, timeSpent } = req.body;
    
    try {
        const success = await repo.submitExamAnswer({ 
            attemptId, 
            examQuestionId, 
            answerText, 
            selectedOptionId, 
            timeSpent 
        });
        
        return responseBuilder.success(res, { 
            success,
            message: "Answer submitted successfully" 
        });
    } catch (err) {
        console.error("Submit answer error:", err);
        return responseBuilder.badRequest(res, err.message);
    }
}

async function submitExamAttempt(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { attemptId } = req.params;
    
    try {
        const result = await repo.submitExam({ attemptId, studentId });
        return responseBuilder.success(res, { 
            ...result,
            message: "Exam submitted successfully" 
        });
    } catch (err) {
        console.error("Submit exam error:", err);
        return responseBuilder.badRequest(res, err.message);
    }
}

async function getExamQuestions(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
    
    const { examId } = req.params;
    
    try {
        const result = await repo.getExamQuestions({ examId, studentId });
        return responseBuilder.success(res, { 
            data: result,
            message: "Exam questions retrieved successfully" 
        });
    } catch (err) {
        console.error("Get exam questions error:", err);
        return responseBuilder.badRequest(res, err.message);
    }
}

async function registerExam(req, res) {
    const studentId = getStudentId(req, res);
    if (!studentId) return responseBuilder.unauthorized(res, "Unauthorized: invalid token");

    // Support payload wrapped in { body: {...} }
    const payload = req.body?.body || req.body || {};
    const { examId, startSlot, notifications, notes, startISO, endISO } = payload;
    if (!examId) return responseBuilder.badRequest(res, "examId is required");

    try {
        const result = await repo.registerForExam({
            studentId,
            examId,
            startSlot,
            notifications,
            notes,
            startISO,
            endISO,
        });
        return responseBuilder.success(res, { data: result, message: "Exam registered successfully" });
    } catch (err) {
        console.error("Register exam error:", err);
        return responseBuilder.serverError(res, "Failed to register for exam");
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
    getStudentExams,
    getUpcomingExams,
    getOnDemandExams,
    getExamResults,
    startExamAttempt,
    submitExamAnswer,
    submitExamAttempt,
    getExamQuestions,
    registerExam,
    listQbank,
    updateDeck,
    deleteDeck
}