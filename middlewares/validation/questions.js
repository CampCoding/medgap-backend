const { body, param } = require("express-validator");

const createQuestionValidation = [
  body("question_text")
    .notEmpty()
    .withMessage("Question text is required")
    .isString()
    .withMessage("Question text must be a string")
    .trim(),
  body("question_type")
    .notEmpty()
    .withMessage("Question type is required")
    .isIn(["multiple_choice", "true_false", "essay"])
    .withMessage(
      "Question type must be one of multiple_choice, true_false, essay"
    ),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("model_answer")
    .optional()
    .isString()
    .withMessage("Model answer must be a string")
    .trim(),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("hint")
    .optional()
    .isString()
    .withMessage("Hint must be a string")
    .trim(),
  body("keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array of strings")
    .custom((value) => {
      if (!value.every((keyword) => typeof keyword === "string")) {
        throw new Error("Each keyword must be a string");
      }
      return true;
    }),
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
  body("help_guidance")
    .optional()
    .isString()
    .withMessage("Help/Guidance must be a string")
    .trim(),
  body("points")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Points must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft", "pending", "approved", "rejected"])
    .withMessage(
      "Status must be one of active, inactive, draft, pending, approved, rejected"
    ),
  body("options")
    .optional()
    .isArray()
    .withMessage("Options must be an array")
    .custom((value) => {
      if (!value.every((option) => 
        typeof option === "object" &&
        option.option_text &&
        typeof option.option_text === "string" &&
        typeof option.is_correct === "boolean" &&
        (option.explanation === undefined || typeof option.explanation === "string") &&
        (option.video_explanation_url === undefined || typeof option.video_explanation_url === "string")
      )) {
        throw new Error("Each option must have option_text (string), is_correct (boolean), and optional explanation/video_explanation_url (strings)");
      }
      return true;
    }),
];

const updateQuestionValidation = [
  param("id").isInt().withMessage("Question ID must be an integer"),
  body("question_text")
    .optional()
    .isString()
    .withMessage("Question text must be a string")
    .trim(),
  body("question_type")
    .optional()
    .isIn(["multiple_choice", "true_false", "essay"])
    .withMessage(
      "Question type must be one of multiple_choice, true_false, essay"
    ),
  body("topic_id")
    .optional()
    .isInt()
    .withMessage("Topic ID must be an integer")
    .customSanitizer((value) => (value === "" ? null : value)),
  body("model_answer")
    .optional()
    .isString()
    .withMessage("Model answer must be a string")
    .trim(),
  body("difficulty_level")
    .optional()
    .isIn(["easy", "medium", "hard"])
    .withMessage("Difficulty level must be one of easy, medium, hard"),
  body("hint")
    .optional()
    .isString()
    .withMessage("Hint must be a string")
    .trim(),
  body("keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array of strings")
    .custom((value) => {
      if (!value.every((keyword) => typeof keyword === "string")) {
        throw new Error("Each keyword must be a string");
      }
      return true;
    }),
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
  body("help_guidance")
    .optional()
    .isString()
    .withMessage("Help/Guidance must be a string")
    .trim(),
  body("points")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Points must be a positive integer"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "draft", "pending", "approved", "rejected"])
    .withMessage(
      "Status must be one of active, inactive, draft, pending, approved, rejected"
    ),
];

module.exports = {
  createQuestionValidation,
  updateQuestionValidation,
};
