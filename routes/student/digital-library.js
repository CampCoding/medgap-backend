const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/student/digitalLibrary");

// Student modules (enrolled subjects)
router.get("/modules", ctrl.listStudentModules);

// Books by module + optional selected book via ?ebook_id=
router.get("/modules/:module_id/books", ctrl.listModuleBooks);

// Increment view count
router.post("/books/:ebook_id/view", ctrl.viewBook);

module.exports = router;
