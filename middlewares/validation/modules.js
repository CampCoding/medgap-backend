const { body } = require("express-validator");

// قواعد التحقق لإنشاء مادة جديدة
const createModuleValidation = [
  body("subject_name")
    .notEmpty()
    .withMessage("Subject name is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Subject name must be between 2 and 200 characters")
    .matches(/^[\u0621-\u064Aa-zA-Z\s\-\(\)0-9]+$/)
    .withMessage(
      "Subject name can only contain Arabic, English letters, numbers, spaces, hyphens, and parentheses"
    ),

  body("subject_code")
    .notEmpty()
    .withMessage("Subject code is required")
    .isLength({ min: 2, max: 20 })
    .withMessage("Subject code must be between 2 and 20 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage("Subject code can only contain uppercase letters and numbers"),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of: active, inactive, draft"),

  body("subject_color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage(
      "Subject color must be a valid hex color code (e.g., #3498db)"
    ),
];

// قواعد التحقق لتحديث مادة
const updateModuleValidation = [
  body("subject_name")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Subject name must be between 2 and 200 characters")
    .matches(/^[\u0621-\u064Aa-zA-Z\s\-\(\)0-9]+$/)
    .withMessage(
      "Subject name can only contain Arabic, English letters, numbers, spaces, hyphens, and parentheses"
    ),

  body("subject_code")
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage("Subject code must be between 2 and 20 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage("Subject code can only contain uppercase letters and numbers"),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be one of: active, inactive, draft"),

  body("subject_color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage(
      "Subject color must be a valid hex color code (e.g., #3498db)"
    ),
];

module.exports = {
  createModuleValidation,
  updateModuleValidation,
};
