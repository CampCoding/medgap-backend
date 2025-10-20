const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/flashcards");

// List libraries for a module
router.get("/modules/:module_id/libraries", ctrl.listLibraries);
router.get("/bulk/:module_id/libraries", ctrl.listLibrariesByBulkModules);

// Get library with cards
router.get("/libraries/:library_id", ctrl.getLibrary);

// Update library progress
router.post("/libraries/:library_id/progress", ctrl.updateLibraryProgress);

// Update card progress
router.post("/cards/:flashcard_id/progress", ctrl.updateCardProgress);

// Import all flashcard libraries to personal deck
router.post("/import-all-to-deck", ctrl.importAllLibrariesToDeck);

// Copy a specific deck by ID to student's personal collection
router.post("/copy-deck/:deck_id", ctrl.copyDeckById);

// List all available decks (for finding decks to copy)
router.get("/decks", ctrl.listAllDecks);

module.exports = router;
