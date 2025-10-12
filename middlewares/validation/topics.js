const { body, param } = require("express-validator");

const createTopicValidation = [
  body("topic_name")
    .notEmpty()
    .withMessage("Topic name is required")
    .isString()
    .withMessage("Topic name must be a string")
    .trim(),
  body("unit_id").optional().isInt().withMessage("Unit ID must be an integer"),
  body("short_description")
    .optional()
    .isString()
    .withMessage("Short description must be a string")
    .trim(),
  body("learning_objectives")
    .optional()
    .isString()
    .withMessage("Learning objectives must be a string")
    .trim(),
  body("topic_order")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Topic order must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings")
    .custom((value) => {
      if (!value.every((tag) => typeof tag === "string")) {
        throw new Error("Each tag must be a string");
      }
      return true;
    }),
];

const updateTopicValidation = [
  param("id").isInt().withMessage("Topic ID must be an integer"),
  body("topic_name")
    .optional()
    .isString()
    .withMessage("Topic name must be a string")
    .trim(),
  body("unit_id")
    .optional()
    .isInt()
    .withMessage("Unit ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)), // Allow null for unlinking
  body("short_description")
    .optional()
    .isString()
    .withMessage("Short description must be a string")
    .trim(),
  body("learning_objectives")
    .optional()
    .isString()
    .withMessage("Learning objectives must be a string")
    .trim(),
  body("topic_order")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Topic order must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of active, inactive, draft"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings")
    .custom((value) => {
      if (!value.every((tag) => typeof tag === "string")) {
        throw new Error("Each tag must be a string");
      }
      return true;
    }),
];

module.exports = {
  createTopicValidation,
  updateTopicValidation,
};
