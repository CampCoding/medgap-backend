const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/flashcards");

// List libraries for a module
router.get("/modules/:module_id/libraries", ctrl.listLibraries);

// Get library with cards
router.get("/libraries/:library_id", ctrl.getLibrary);

// Update library progress
router.post("/libraries/:library_id/progress", ctrl.updateLibraryProgress);

// Update card progress
router.post("/cards/:flashcard_id/progress", ctrl.updateCardProgress);

module.exports = router;
