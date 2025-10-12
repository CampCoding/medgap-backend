const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/quotes");
const { requireAuth } = require("../../middlewares/jwt");

// Apply authentication middleware to all routes
router.use(requireAuth("admin"));

// Quote CRUD operations
router.get("/", controller.getAllQuotes);
router.get("/categories", controller.getQuoteCategories);
router.get("/:id", controller.getQuoteById);
router.post("/", controller.createQuote);
router.put("/:id", controller.updateQuote);
router.delete("/:id", controller.deleteQuote);

module.exports = router;
