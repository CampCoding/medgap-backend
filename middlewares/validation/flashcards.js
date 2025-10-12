const { body, param } = require("express-validator");

const createFlashcardValidation = [
  body("front_text")
    .notEmpty()
    .withMessage("Front text is required")
    .isString()
    .withMessage("Front text must be a string")
    .trim(),
  body("back_text")
    .notEmpty()
    .withMessage("Back text is required")
    .isString()
    .withMessage("Back text must be a string")
    .trim(),
  body("library_id")
    .optional()
    .isInt()
    .withMessage("Library ID must be an integer"),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("card_order")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Card order must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
];

const updateFlashcardValidation = [
  param("id").isInt().withMessage("Flashcard ID must be an integer"),
  body("front_text")
    .optional()
    .isString()
    .withMessage("Front text must be a string")
    .trim(),
  body("back_text")
    .optional()
    .isString()
    .withMessage("Back text must be a string")
    .trim(),
  body("library_id")
    .optional()
    .isInt()
    .withMessage("Library ID must be an integer"),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("card_order")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Card order must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
];

const createFlashcardLibraryValidation = [
  body("library_name")
    .notEmpty()
    .withMessage("Library name is required")
    .isString()
    .withMessage("Library name must be a string")
    .trim(),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .trim(),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("estimated_time")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Estimated time must be a positive integer (in minutes)"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
];

const updateFlashcardLibraryValidation = [
  param("id").isInt().withMessage("Library ID must be an integer"),
  body("library_name")
    .optional()
    .isString()
    .withMessage("Library name must be a string")
    .trim(),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .trim(),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("estimated_time")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Estimated time must be a positive integer (in minutes)"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
];

module.exports = {
  createFlashcardValidation,
  updateFlashcardValidation,
  createFlashcardLibraryValidation,
  updateFlashcardLibraryValidation,
};