const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/flashcards");
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

async function listLibraries(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  const { module_id } = req.params;
  const { page = 1, limit = 12, search = "" } = req.query;
  try {
    const result = await repo.listLibrariesByModule({
      moduleId: Number(module_id),
      studentId,
      page: Number(page),
      limit: Number(limit),
      search,
    });
    return responseBuilder.success(res, {
      data: result,
      message: "Flashcard libraries retrieved successfully",
    });
  } catch (e) {
    return responseBuilder.serverError(res, "Failed to get libraries");
  }
}



async function listLibrariesByBulkModules(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  const { module_id } = req.params;
  const { page = 1, limit = 12, search = "" } = req.query;
  console.log(JSON.parse(module_id))
  // try {
    const result = await repo.listLibrariesByBulkModules({
      moduleId: JSON.parse(module_id),
      studentId,
      page: Number(page),
      limit: Number(limit),
      search,
    });
    return responseBuilder.success(res, {
      data: result,
      message: "Flashcard libraries retrieved successfully",
    });
  // } catch (e) {
  //   return responseBuilder.serverError(res, "Failed to get libraries");
  // }
}

async function getLibrary(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  const { library_id } = req.params;
  try {
    const data = await repo.getLibraryWithCards({
      libraryId: Number(library_id),
      studentId,
    });
    if (!data) return responseBuilder.notFound(res, "Library not found");
    return responseBuilder.success(res, {
      data,
      message: "Flashcard library retrieved successfully",
    });
  } catch (e) {
    return responseBuilder.serverError(res, "Failed to get library");
  }
}

async function updateLibraryProgress(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  const { library_id } = req.params;
  const {
    studied_count = 0,
    correct_count = 0,
    time_spent = 0,
    status = "in_progress",
  } = req.body || {};
  try {
    await repo.upsertLibraryProgress({
      studentId,
      libraryId: Number(library_id),
      studiedCount: studied_count,
      correctCount: correct_count,
      timeSpent: time_spent,
      status,
    });
    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Library progress updated",
    });
  } catch (e) {
    return responseBuilder.serverError(
      res,
      "Failed to update library progress"
    );
  }
}

async function updateCardProgress(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  const { flashcard_id } = req.params;
  const { attempts = 1, correct = 0, status = "seen" } = req.body || {};
  try {
    await repo.upsertCardProgress({
      studentId,
      flashcardId: Number(flashcard_id),
      attempts,
      correct,
      status,
    });
    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Card progress updated",
    });
  } catch (e) {
    return responseBuilder.serverError(res, "Failed to update card progress");
  }
}

async function importAllLibrariesToDeck(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  
  const { deck_title, deck_description } = req.body || {};
  
  try {
    const result = await repo.importAllLibrariesToDeck({
      studentId,
      deckTitle: deck_title || "Imported Flashcards",
      deckDescription: deck_description || "All flashcard libraries imported to personal deck"
    });

    if (!result.success) {
      return responseBuilder.badRequest(res, result.message);
    }

    return responseBuilder.success(res, {
      data: {
        deck_id: result.deckId,
        imported_libraries: result.importedLibraries,
        imported_cards: result.importedCards,
        libraries: result.libraries
      },
      message: result.message
    }, 201);

  } catch (error) {
    console.error("Error importing libraries to deck:", error);
    return responseBuilder.serverError(res, "Failed to import libraries to deck");
  }
}

async function copyDeckById(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId)
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  
  const { deck_id } = req.params;
  const { deck_title, deck_description } = req.body || {};
  
  // Validate deck_id
  if (!deck_id || isNaN(Number(deck_id))) {
    return responseBuilder.badRequest(res, "Invalid deck ID");
  }
  
  try {
    const result = await repo.copyDeckById({
      sourceDeckId: Number(deck_id),
      studentId,
      newDeckTitle: deck_title,
      newDeckDescription: deck_description
    });

    if (!result.success) {
      return responseBuilder.badRequest(res, result.message);
    }

    return responseBuilder.success(res, {
      data: {
        new_deck_id: result.newDeckId,
        copied_cards: result.copiedCards,
        source_deck: result.sourceDeck,
        new_deck: result.newDeck
      },
      message: result.message
    }, 201);

  } catch (error) {
    console.error("Error copying deck:", error);
    return responseBuilder.serverError(res, "Failed to copy deck");
  }
}

module.exports = {
  listLibraries,
  getLibrary,
  updateLibraryProgress,
  updateCardProgress,
  listLibrariesByBulkModules,
  importAllLibrariesToDeck,
  copyDeckById
};
