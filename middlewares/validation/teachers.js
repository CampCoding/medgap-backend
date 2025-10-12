const { body } = require("express-validator");

// قواعد التحقق لإنشاء مدرس جديد
const createTeacherValidation = [
  body("full_name")
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Full name must be between 2 and 200 characters")
    .matches(/^[\u0621-\u064Aa-zA-Z\s]+$/)
    .withMessage("Full name can only contain Arabic and English letters"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage("Email must not exceed 200 characters"),

  body("phone")
    .optional()
    .matches(/^[\+]?[0-9\s\-\(\)]{10,30}$/)
    .withMessage("Please provide a valid phone number"),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),

  body("module_ids")
    .optional()
    .isArray()
    .withMessage("Module IDs must be an array")
    .custom((moduleIds) => {
      if (moduleIds && moduleIds.length > 0) {
        const invalidIds = moduleIds.filter((id) => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          throw new Error("All module IDs must be valid numbers");
        }
      }
      return true;
    }),

  body("experience_years")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("Experience years must be between 0 and 50"),

  body("join_date")
    .optional()
    .isISO8601()
    .withMessage("Join date must be a valid date")
    .custom((date) => {
      const joinDate = new Date(date);
      const currentDate = new Date();
      const maxDate = new Date();
      maxDate.setFullYear(currentDate.getFullYear() + 1); // السماح بتاريخ مستقبلي لسنة واحدة

      if (joinDate > maxDate) {
        throw new Error("Join date cannot be more than 1 year in the future");
      }
      return true;
    }),

  body("role")
    .optional()
    .isIn(["teacher", "head_of_department", "assistant"])
    .withMessage("Role must be one of: teacher, head_of_department, assistant"),

  body("qualification")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Qualification must not exceed 500 characters"),

  body("image_url")
    .optional()
    .isURL()
    .withMessage("Image URL must be a valid URL")
    .isLength({ max: 500 })
    .withMessage("Image URL must not exceed 500 characters"),
];

// قواعد التحقق لتحديث مدرس
const updateTeacherValidation = [
  body("full_name")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Full name must be between 2 and 200 characters")
    .matches(/^[\u0621-\u064Aa-zA-Z\s]+$/)
    .withMessage("Full name can only contain Arabic and English letters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage("Email must not exceed 200 characters"),

  body("phone")
    .optional()
    .matches(/^[\+]?[0-9\s\-\(\)]{10,30}$/)
    .withMessage("Please provide a valid phone number"),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),

  body("module_ids")
    .optional()
    .isArray()
    .withMessage("Module IDs must be an array")
    .custom((moduleIds) => {
      if (moduleIds && moduleIds.length > 0) {
        const invalidIds = moduleIds.filter((id) => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          throw new Error("All module IDs must be valid numbers");
        }
      }
      return true;
    }),

  body("experience_years")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("Experience years must be between 0 and 50"),

  body("join_date")
    .optional()
    .isISO8601()
    .withMessage("Join date must be a valid date")
    .custom((date) => {
      const joinDate = new Date(date);
      const currentDate = new Date();
      const maxDate = new Date();
      maxDate.setFullYear(currentDate.getFullYear() + 1);

      if (joinDate > maxDate) {
        throw new Error("Join date cannot be more than 1 year in the future");
      }
      return true;
    }),

  body("role")
    .optional()
    .isIn(["teacher", "head_of_department", "assistant"])
    .withMessage("Role must be one of: teacher, head_of_department, assistant"),

  body("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Status must be one of: pending, approved, rejected"),

  body("qualification")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Qualification must not exceed 500 characters"),

  body("image_url")
    .optional()
    .isURL()
    .withMessage("Image URL must be a valid URL")
    .isLength({ max: 500 })
    .withMessage("Image URL must not exceed 500 characters"),
];

// قواعد التحقق لتغيير حالة المدرس
const changeStatusValidation = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Status must be one of: pending, approved, rejected"),
];

// قواعد التحقق لإضافة مادة للمدرس
const assignModuleValidation = [
  body("module_id")
    .notEmpty()
    .withMessage("Module ID is required")
    .isInt({ min: 1 })
    .withMessage("Module ID must be a positive integer"),
];

// قواعد التحقق لتحديث مواد المدرس
const updateModulesValidation = [
  body("module_ids")
    .isArray()
    .withMessage("Module IDs must be an array")
    .custom((moduleIds) => {
      if (moduleIds && moduleIds.length > 0) {
        const invalidIds = moduleIds.filter(
          (id) => isNaN(parseInt(id)) || parseInt(id) < 1
        );
        if (invalidIds.length > 0) {
          throw new Error("All module IDs must be positive integers");
        }
      }
      return true;
    }),
];

module.exports = {
  createTeacherValidation,
  updateTeacherValidation,
  changeStatusValidation,
  assignModuleValidation,
  updateModulesValidation,
};
