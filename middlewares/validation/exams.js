const responseBuilder = require("../../utils/responsebuilder");

// Validation for creating exam
const createExamValidation = (req, res, next) => {
  const { title, subject_id, teacher_id, difficulty, duration } = req.body;

  // Required fields validation
  if (!title || !title.trim()) {
    return responseBuilder.badRequest(res, "Exam title is required");
  }


  if (!difficulty) {
    return responseBuilder.badRequest(res, "Difficulty level is required");
  }

  if (!duration) {
    return responseBuilder.badRequest(res, "Duration is required");
  }

  // Validate difficulty enum
  const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
  if (!validDifficulties.includes(difficulty)) {
    return responseBuilder.badRequest(res, "Invalid difficulty level. Must be one of: easy, medium, hard, expert");
  }

  // Validate duration (must be positive integer)
  const durationNum = parseInt(duration);
  if (isNaN(durationNum) || durationNum <= 0) {
    return responseBuilder.badRequest(res, "Duration must be a positive number");
  }

  // Validate title length
  if (title.trim().length < 3) {
    return responseBuilder.badRequest(res, "Exam title must be at least 3 characters long");
  }

  if (title.trim().length > 200) {
    return responseBuilder.badRequest(res, "Exam title must not exceed 200 characters");
  }

  // Validate duration range (1 minute to 8 hours)
  if (durationNum < 1 || durationNum > 480) {
    return responseBuilder.badRequest(res, "Duration must be between 1 and 480 minutes");
  }

  next();
};

// Validation for updating exam
const updateExamValidation = (req, res, next) => {
  const { title, subject_id, teacher_id, difficulty, duration, total_points, passing_score } = req.body;

  // Validate title if provided
  if (title !== undefined) {
    if (!title || !title.trim()) {
      return responseBuilder.badRequest(res, "Exam title cannot be empty");
    }
    if (title.trim().length < 3) {
      return responseBuilder.badRequest(res, "Exam title must be at least 3 characters long");
    }
    if (title.trim().length > 200) {
      return responseBuilder.badRequest(res, "Exam title must not exceed 200 characters");
    }
  }

  // Validate difficulty if provided
  if (difficulty !== undefined) {
    const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
    if (!validDifficulties.includes(difficulty)) {
      return responseBuilder.badRequest(res, "Invalid difficulty level. Must be one of: easy, medium, hard, expert");
    }
  }

  // Validate duration if provided
  if (duration !== undefined) {
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      return responseBuilder.badRequest(res, "Duration must be a positive number");
    }
    if (durationNum < 1 || durationNum > 480) {
      return responseBuilder.badRequest(res, "Duration must be between 1 and 480 minutes");
    }
  }

  // Validate total_points if provided
  if (total_points !== undefined) {
    const pointsNum = parseInt(total_points);
    if (isNaN(pointsNum) || pointsNum < 0) {
      return responseBuilder.badRequest(res, "Total points must be a non-negative number");
    }
  }

  // Validate passing_score if provided
  if (passing_score !== undefined) {
    const scoreNum = parseInt(passing_score);
    if (isNaN(scoreNum) || scoreNum < 0) {
      return responseBuilder.badRequest(res, "Passing score must be a non-negative number");
    }
    
    // If both total_points and passing_score are provided, validate passing_score <= total_points
    if (total_points !== undefined) {
      const totalPointsNum = parseInt(total_points);
      if (scoreNum > totalPointsNum) {
        return responseBuilder.badRequest(res, "Passing score cannot be greater than total points");
      }
    }
  }

  next();
};

// Validation for adding question to exam
const addQuestionValidation = (req, res, next) => {
  const { question_id, order_index, points, time_limit } = req.body;


  // Validate order_index if provided
  if (order_index !== undefined) {
    const orderNum = parseInt(order_index);
    if (isNaN(orderNum) || orderNum < 0) {
      return responseBuilder.badRequest(res, "Order index must be a non-negative number");
    }
  }

  // Validate points if provided
  if (points !== undefined) {
    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      return responseBuilder.badRequest(res, "Points must be a positive number");
    }
  }

  // Validate time_limit if provided
  if (time_limit !== undefined) {
    const timeNum = parseInt(time_limit);
    if (isNaN(timeNum) || timeNum <= 0) {
      return responseBuilder.badRequest(res, "Time limit must be a positive number");
    }
    if (timeNum > 3600) { // Max 1 hour per question
      return responseBuilder.badRequest(res, "Time limit cannot exceed 3600 seconds (1 hour)");
    }
  }

  next();
};

// Validation for removing question from exam
const removeQuestionValidation = (req, res, next) => {
  const { questionId } = req.params;

  if (!questionId || !questionId.trim()) {
    return responseBuilder.badRequest(res, "Question ID is required");
  }

  next();
};

// Validation for updating exam status
const updateStatusValidation = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return responseBuilder.badRequest(res, "Status is required");
  }

  const validStatuses = ['draft', 'published', 'scheduled', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return responseBuilder.badRequest(res, "Invalid status. Must be one of: draft, published, scheduled, completed, cancelled");
  }

  next();
};

module.exports = {
  createExamValidation,
  updateExamValidation,
  addQuestionValidation,
  removeQuestionValidation,
  updateStatusValidation,
};
