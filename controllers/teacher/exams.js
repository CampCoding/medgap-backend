const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/teacher/exams");

// Get all exams for the current teacher with pagination and filters
async function getAllExams(req, res) {
  try {
      console.log("req.user", req.user)
    const teacherId = req.user?.teacher_id;
    const { 
      page = 1, 
      limit = 20, 
      search = "", 
      subject = "", 
      status = "",
      difficulty = ""
    } = req.query;
    
    const offset = (page - 1) * limit;

    const exams = await repo.getAllExams({
      teacherId,
      offset: parseInt(offset),
      limit: parseInt(limit),
      search,
      subject,
      status,
      difficulty,
    });

    return responseBuilder.success(res, {
      data: exams,
      message: "Exams retrieved successfully",
    });
  } catch (error) {
    console.error("Get exams error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve exams");
  }
}

// Get exam statistics for the current teacher
async function getExamStats(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const stats = await repo.getExamStats(teacherId);
    return responseBuilder.success(res, {
      data: stats,
      message: "Exam statistics retrieved successfully",
    });
  } catch (error) {
    console.error("Get exam stats error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve exam statistics");
  }
}

// Get exam by ID (only if owned by current teacher)
async function getExamById(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const exam = await repo.getExamById(id, teacherId);

    if (!exam) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to access it");
    }

    return responseBuilder.success(res, {
      data: exam,
      message: "Exam retrieved successfully",
    });
  } catch (error) {
    console.error("Get exam error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve exam");
  }
}

// Get exam questions (only if owned by current teacher)
async function getExamQuestions(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const questions = await repo.getExamQuestions(id, teacherId);

    return responseBuilder.success(res, {
      data: questions,
      message: "Exam questions retrieved successfully",
    });
  } catch (error) {
    console.error("Get exam questions error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve exam questions");
  }
}

// Get exam attempts (only if owned by current teacher)
async function getExamAttempts(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const attempts = await repo.getExamAttempts(id, teacherId, {
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    return responseBuilder.success(res, {
      data: attempts,
      message: "Exam attempts retrieved successfully",
    });
  } catch (error) {
    console.error("Get exam attempts error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve exam attempts");
  }
}

// Create new exam
async function createExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const {
      title,
      subject_id, // Column name is subject_id but references units.unit_id
      difficulty,
      duration,
      instructions = "",
      settings = {},
      question_ids = [], // Array of question IDs to add to exam
      // Question selection parameters
      question_selection_type,
      total_questions,
      questions_per_difficulty,
      topic_ids,
      question_types,
    } = req.body;
console.log({
  title: title.trim(),
  user: req.user,
  subject_id, // Column name is subject_id but references units.unit_id
  teacher_id: teacherId, // Use the authenticated teacher's ID
  difficulty,
  duration: parseInt(duration),
  instructions: instructions.trim(),
  settings: JSON.stringify(settings),
  created_by: teacherId,
  question_ids, // Pass question IDs to repository
  // Question selection parameters
  question_selection_type,
  total_questions,
  questions_per_difficulty,
  topic_ids,
  question_types,
})
    const examData = {
      title: title.trim(),
      subject_id, // Column name is subject_id but references units.unit_id
      teacher_id: teacherId, // Use the authenticated teacher's ID
      difficulty,
      duration: parseInt(duration),
      instructions: instructions.trim(),
      settings: JSON.stringify(settings),
      created_by: teacherId,
      question_ids, // Pass question IDs to repository
      // Question selection parameters
      question_selection_type,
      total_questions,
      questions_per_difficulty,
      topic_ids,
      question_types,
    };

    const newExam = await repo.createExam(examData);

    return responseBuilder.success(res, {
      data: newExam,
      message: "Exam created successfully",
    });
  } catch (error) {
    console.error("Create exam error:", error);
    return responseBuilder.serverError(res, "Failed to create exam");
  }
}

// Update exam (only if owned by current teacher)
async function updateExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const {
      title,
      subject_id,
      difficulty,
      duration,
      total_points,
      passing_score,
      instructions,
      settings
    } = req.body;

    const updateData = {
      examId: id,
      teacherId, // Add teacher ID for ownership check
      title: title?.trim(),
      subject_id,
      difficulty,
      duration: duration ? parseInt(duration) : undefined,
      total_points: total_points ? parseInt(total_points) : undefined,
      passing_score: passing_score ? parseInt(passing_score) : undefined,
      instructions: instructions?.trim(),
      settings: settings ? JSON.stringify(settings) : undefined,
      updated_by: teacherId,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updated = await repo.updateExam(updateData);

    if (!updated) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to update it");
    }

    const exam = await repo.getExamById(id, teacherId);
    return responseBuilder.success(res, {
      data: exam,
      message: "Exam updated successfully",
    });
  } catch (error) {
    console.error("Update exam error:", error);
    return responseBuilder.serverError(res, "Failed to update exam");
  }
}

// Update exam status (only if owned by current teacher)
async function updateExamStatus(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'scheduled', 'completed', 'cancelled'].includes(status)) {
      return responseBuilder.badRequest(res, "Invalid status value");
    }

    const updated = await repo.updateExamStatus(id, status, teacherId);

    if (!updated) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to update it");
    }

    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Exam status updated successfully",
    });
  } catch (error) {
    console.error("Update exam status error:", error);
    return responseBuilder.serverError(res, "Failed to update exam status");
  }
}

// Add question to exam (only if owned by current teacher)
async function addQuestionToExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const { question_id, order_index = 0, points, time_limit } = req.body;

    const examQuestion = await repo.addQuestionToExam({
      examId: id,
      teacherId,
      questionId: question_id,
      orderIndex: order_index,
      points,
      timeLimit: time_limit,
    });

    return responseBuilder.success(res, {
      data: examQuestion,
      message: "Question added to exam successfully",
    });
  } catch (error) {
    console.error("Add question to exam error:", error);
    return responseBuilder.serverError(res, "Failed to add question to exam");
  }
}

// Update exam question (only if owned by current teacher)
async function updateExamQuestion(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id, questionId } = req.params;
    const { order_index, points, time_limit } = req.body;

    const updateData = {
      examId: id,
      teacherId,
      questionId,
      orderIndex: order_index,
      points,
      timeLimit: time_limit,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updated = await repo.updateExamQuestion(updateData);

    if (!updated) {
      return responseBuilder.notFound(res, "Exam question not found or you don't have permission to update it");
    }

    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Exam question updated successfully",
    });
  } catch (error) {
    console.error("Update exam question error:", error);
    return responseBuilder.serverError(res, "Failed to update exam question");
  }
}

// Remove question from exam (only if owned by current teacher)
async function removeQuestionFromExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id, questionId } = req.params;

    const removed = await repo.removeQuestionFromExam(id, questionId, teacherId);

    if (!removed) {
      return responseBuilder.notFound(res, "Exam question not found or you don't have permission to remove it");
    }

    return responseBuilder.success(res, {
      data: { removed: true },
      message: "Question removed from exam successfully",
    });
  } catch (error) {
    console.error("Remove question from exam error:", error);
    return responseBuilder.serverError(res, "Failed to remove question from exam");
  }
}

// Start exam (only if owned by current teacher)
async function startExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;
    const { scheduled_date } = req.body;

    const started = await repo.startExam(id, scheduled_date, teacherId);

    if (!started) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to start it");
    }

    return responseBuilder.success(res, {
      data: { started: true },
      message: "Exam started successfully",
    });
  } catch (error) {
    console.error("Start exam error:", error);
    return responseBuilder.serverError(res, "Failed to start exam");
  }
}

// Stop exam (only if owned by current teacher)
async function stopExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;

    const stopped = await repo.stopExam(id, teacherId);

    if (!stopped) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to stop it");
    }

    return responseBuilder.success(res, {
      data: { stopped: true },
      message: "Exam stopped successfully",
    });
  } catch (error) {
    console.error("Stop exam error:", error);
    return responseBuilder.serverError(res, "Failed to stop exam");
  }
}

// Publish exam (only if owned by current teacher)
async function publishExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;

    const published = await repo.publishExam(id, teacherId);

    if (!published) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to publish it");
    }

    return responseBuilder.success(res, {
      data: { published: true },
      message: "Exam published successfully",
    });
  } catch (error) {
    console.error("Publish exam error:", error);
    return responseBuilder.serverError(res, "Failed to publish exam");
  }
}

// Unpublish exam (only if owned by current teacher)
async function unpublishExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;

    const unpublished = await repo.unpublishExam(id, teacherId);

    if (!unpublished) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to unpublish it");
    }

    return responseBuilder.success(res, {
      data: { unpublished: true },
      message: "Exam unpublished successfully",
    });
  } catch (error) {
    console.error("Unpublish exam error:", error);
    return responseBuilder.serverError(res, "Failed to unpublish exam");
  }
}

// Delete exam (only if owned by current teacher)
async function deleteExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;

    const deleted = await repo.deleteExam(id, teacherId);

    if (!deleted) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to delete it");
    }

    return responseBuilder.success(res, {
      data: { deleted: true },
      message: "Exam deleted successfully",
    });
  } catch (error) {
    console.error("Delete exam error:", error);
    return responseBuilder.serverError(res, "Failed to delete exam");
  }
}

// Permanent delete exam (only if owned by current teacher)
async function permanentDeleteExam(req, res) {
  try {
    const teacherId = req.user?.teacher_id;
    const { id } = req.params;

    const deleted = await repo.permanentDeleteExam(id, teacherId);

    if (!deleted) {
      return responseBuilder.notFound(res, "Exam not found or you don't have permission to delete it");
    }

    return responseBuilder.success(res, {
      data: { deleted: true },
      message: "Exam permanently deleted successfully",
    });
  } catch (error) {
    console.error("Permanent delete exam error:", error);
    return responseBuilder.serverError(res, "Failed to permanently delete exam");
  }
}

module.exports = {
  getAllExams,
  getExamStats,
  getExamById,
  getExamQuestions,
  getExamAttempts,
  createExam,
  updateExam,
  updateExamStatus,
  addQuestionToExam,
  updateExamQuestion,
  removeQuestionFromExam,
  startExam,
  stopExam,
  publishExam,
  unpublishExam,
  deleteExam,
  permanentDeleteExam,
};
