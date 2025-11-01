const express = require("express");
const router = express.Router();
const flashcardsController = require("../../controllers/flashcards/flashcards");
const {
  createFlashcardLibraryValidation,
  updateFlashcardLibraryValidation,
  createFlashcardValidation,
  updateFlashcardValidation,
} = require("../../middlewares/validation/flashcards");
const jwtMiddleware = require("../../middlewares/jwt"); // Assuming JWT middleware is used for auth
const { uploadFlashcards } = require("../../utils/multer-upload-flashcards");

// --- Flashcard Libraries ---

// Get flashcard library statistics
router.get("/libraries/stats", flashcardsController.getFlashcardLibrariesStats);

// Get all flashcard libraries with filters
router.get("/libraries", flashcardsController.getAllFlashcardLibraries);

// Get flashcard library by ID
router.get("/libraries/:id", flashcardsController.getFlashcardLibraryById);

// Get flashcards within a specific library
router.get("/libraries/:id/cards", flashcardsController.getFlashcardsInLibrary);

// Create a new flashcard library (Admin/Teacher only)
router.post(
  "/libraries",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  // createFlashcardLibraryValidation,
  flashcardsController.createFlashcardLibrary
);

// Upload flashcards from file (Admin/Teacher only)
router.post(
  "/upload",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  uploadFlashcards.single("file"),
  flashcardsController.uploadFlashcardsFromFile
);

// Update a flashcard library (Admin/Teacher only)
router.put(
  "/libraries/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  updateFlashcardLibraryValidation,
  flashcardsController.updateFlashcardLibrary
);

// Delete a flashcard library (soft delete - Admin/Teacher only)
router.delete(
  "/libraries/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  flashcardsController.deleteFlashcardLibrary
);

// --- Individual Flashcards ---

// Get all flashcards (across all libraries, with filters)
router.get("/cards", flashcardsController.getAllFlashcards);

// Get flashcard by ID
router.get("/cards/:id", flashcardsController.getFlashcardById);

// Create a new flashcard (Admin/Teacher only)
router.post(
  "/cards",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  createFlashcardValidation,
  flashcardsController.createFlashcard
);

// Update a flashcard (Admin/Teacher only)
router.put(
  "/cards/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  updateFlashcardValidation,
  flashcardsController.updateFlashcard
);

// Delete a flashcard (soft delete - Admin/Teacher only)
router.delete(
  "/cards/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  flashcardsController.deleteFlashcard
);

module.exports = router;
