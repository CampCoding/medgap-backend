const { body, param } = require("express-validator");

const createDigitalLibraryFileValidation = [
  body("book_title")
    .notEmpty()
    .withMessage("Book title is required")
    .isString()
    .withMessage("Book title must be a string")
    .trim(),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .trim(),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("file_name")
    .notEmpty()
    .withMessage("File name is required")
    .isString()
    .withMessage("File name must be a string")
    .trim(),
  body("original_name")
    .notEmpty()
    .withMessage("Original name is required")
    .isString()
    .withMessage("Original name must be a string")
    .trim(),
  body("file_path")
    .notEmpty()
    .withMessage("File path is required")
    .isString()
    .withMessage("File path must be a string")
    .trim(),
  body("file_type")
    .optional()
    .isString()
    .withMessage("File type must be a string")
    .trim(),
  body("file_size")
    .optional()
    .isInt({ min: 0 })
    .withMessage("File size must be a non-negative integer"),
  body("pages_count")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Pages count must be a positive integer"),
];

const updateDigitalLibraryFileValidation = [
  param("id").isInt().withMessage("File ID must be an integer"),
  body("book_title")
    .optional()
    .isString()
    .withMessage("Book title must be a string")
    .trim(),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .trim(),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("file_name")
    .optional()
    .isString()
    .withMessage("File name must be a string")
    .trim(),
  body("original_name")
    .optional()
    .isString()
    .withMessage("Original name must be a string")
    .trim(),
  body("file_path")
    .optional()
    .isString()
    .withMessage("File path must be a string")
    .trim(),
  body("file_type")
    .optional()
    .isString()
    .withMessage("File type must be a string")
    .trim(),
  body("file_size")
    .optional()
    .isInt({ min: 0 })
    .withMessage("File size must be a non-negative integer"),
  body("pages_count")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Pages count must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be one of active, inactive"),
];

const updateFileStatusValidation = [
  param("id").isInt().withMessage("File ID must be an integer"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isString()
    .withMessage("Status must be a string")
    .trim(),
];

module.exports = {
  createDigitalLibraryFileValidation,
  updateDigitalLibraryFileValidation,
  updateFileStatusValidation,
};
