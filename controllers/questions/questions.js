const questionsRepository = require("../../repositories/questions/questions");
const responseBuilder = require("../../utils/responsebuilder");
const { validationResult } = require("express-validator");
const { parseQuestionsFromText } = require("../../utils/question-parser");
const fs = require("fs");

class QuestionsController {
  // إنشاء سؤال جديد
  async createQuestion(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const question = await questionsRepository.createQuestion(req.body, createdBy);

      return responseBuilder.success(
        res,
        {
          message: "Question created successfully",
          question: question,
        },
        201
      );
    } catch (error) {
      console.error("Error creating question:", error);
      return responseBuilder.serverError(res, "Failed to create question");
    }
  }

  // جميع الأسئلة (بنك الأسئلة)
  async getAllQuestions(req, res) {
    try {
      const {
        topic_id,
        question_type,
        difficulty_level,
        status,
        search,
        tags,
        limit = 10000000000000000000,
        page = 1,
      } = req.query;

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        topic_id: topic_id ? parseInt(topic_id) : undefined,
        question_type,
        difficulty_level,
        status,
        search,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        limit: limitNum,
        offset: offset,
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على الأسئلة والعدد الإجمالي
      const [questions, totalCount] = await Promise.all([
        questionsRepository.getAllQuestions(filters),
        questionsRepository.getQuestionsCount(filters),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} questions in the question bank`,
        data: {
          message: `Found ${totalCount} questions in the question bank`,
          questions,
          count: questions.length,
          filters: {
            topic_id: filters.topic_id,
            question_type: filters.question_type,
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            search: filters.search,
            tags: filters.tags,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      return responseBuilder.serverError(res, "Failed to fetch questions");
    }
  }

  // سؤال بواسطة ID مع خياراته
  async getQuestionById(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const question = await questionsRepository.getQuestionById(questionId);

      if (!question) {
        return responseBuilder.notFound(res, "Question not found");
      }

      return responseBuilder.success(res, {
        message: "Question retrieved successfully",
        question: question,
      });
    } catch (error) {
      console.error("Error fetching question:", error);
      return responseBuilder.serverError(res, "Failed to fetch question");
    }
  }

  // خيارات السؤال
  async getQuestionOptions(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const options = await questionsRepository.getQuestionOptions(questionId);
      return responseBuilder.success(res, {
        message: "Question options retrieved successfully",
        question_id: questionId,
        options,
        count: options.length,
      });
    } catch (error) {
      console.error("Error fetching question options:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch question options"
      );
    }
  }

  // إنشاء خيارات السؤال
  async createQuestionOptions(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const options = req.body?.options;
      if (!Array.isArray(options) || options.length === 0) {
        return responseBuilder.validationError(res, [
          { msg: "options array is required", param: "options", location: "body" },
        ]);
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      await questionsRepository.createQuestionOptions(questionId, options, createdBy);
      const updated = await questionsRepository.getQuestionById(questionId);
      return responseBuilder.success(
        res,
        {
          message: "Question options created successfully",
          question: updated,
        },
        201
      );
    } catch (error) {
      console.error("Error creating question options:", error);
      return responseBuilder.serverError(
        res,
        "Failed to create question options"
      );
    }
  }

  // تحديث بيانات سؤال
  async updateQuestion(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const updatedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const question = await questionsRepository.updateQuestion(questionId, req.body, updatedBy);

      return responseBuilder.success(res, {
        message: "Question updated successfully",
        question: question,
      });
    } catch (error) {
      console.error("Error updating question:", error);
      return responseBuilder.serverError(res, "Failed to update question");
    }
  }

  // تحديث خيار سؤال
  async updateQuestionOption(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      const optionId = parseInt(req.params.optionId);
      if (isNaN(questionId) || isNaN(optionId)) {
        return responseBuilder.badRequest(res, "Invalid question or option ID");
      }

      const updated = await questionsRepository.updateQuestionOption(
        questionId,
        optionId,
        req.body || {}
      );

      return responseBuilder.success(res, {
        message: "Question option updated successfully",
        question: updated,
      });
    } catch (error) {
      console.error("Error updating question option:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update question option"
      );
    }
  }

  // حذف سؤال (soft delete)
  async deleteQuestion(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const deletedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const result = await questionsRepository.deleteQuestion(questionId, deletedBy);

      return responseBuilder.success(res, {
        message: "Question deleted successfully",
        result: result,
      });
    } catch (error) {
      console.error("Error deleting question:", error);
      return responseBuilder.serverError(res, "Failed to delete question");
    }
  }

  // حذف سؤال نهائياً
  async permanentDeleteQuestion(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const result = await questionsRepository.permanentDeleteQuestion(questionId);

      return responseBuilder.success(res, {
        message: "Question permanently deleted",
        result: result,
      });
    } catch (error) {
      console.error("Error permanently deleting question:", error);
      return responseBuilder.serverError(
        res,
        "Failed to permanently delete question"
      );
    }
  }

  // حذف خيار سؤال
  async deleteQuestionOption(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      const optionId = parseInt(req.params.optionId);
      if (isNaN(questionId) || isNaN(optionId)) {
        return responseBuilder.badRequest(res, "Invalid question or option ID");
      }

      const updated = await questionsRepository.deleteQuestionOption(questionId, optionId);
      return responseBuilder.success(res, {
        message: "Question option deleted successfully",
        question: updated,
      });
    } catch (error) {
      console.error("Error deleting question option:", error);
      return responseBuilder.serverError(
        res,
        "Failed to delete question option"
      );
    }
  }

  // نسخ سؤال
  async duplicateQuestion(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const duplicateQuestion = await questionsRepository.duplicateQuestion(questionId, createdBy);

      return responseBuilder.success(
        res,
        {
          message: "Question duplicated successfully",
          original_question_id: questionId,
          duplicate_question: duplicateQuestion,
        },
        201
      );
    } catch (error) {
      console.error("Error duplicating question:", error);
      return responseBuilder.serverError(res, "Failed to duplicate question");
    }
  }

  // البحث في الأسئلة
  async searchQuestions(req, res) {
    try {
      const {
        q: searchTerm,
        topic_id,
        question_type,
        difficulty_level,
        status,
        tags,
        limit = 10,
        page = 1,
      } = req.query;

      if (!searchTerm || searchTerm.trim() === "") {
        return responseBuilder.badRequest(res, "Search term is required");
      }

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        search: searchTerm.trim(),
        topic_id: topic_id ? parseInt(topic_id) : undefined,
        question_type,
        difficulty_level,
        status,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        limit: limitNum,
        offset: offset,
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على الأسئلة والعدد الإجمالي
      const [questions, totalCount] = await Promise.all([
        questionsRepository.getAllQuestions(filters),
        questionsRepository.getQuestionsCount(filters),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} questions matching "${searchTerm}"`,
        data: {
          message: `Found ${totalCount} questions matching "${searchTerm}"`,
          search_term: searchTerm,
          questions,
          count: questions.length,
          filters: {
            search: searchTerm,
            topic_id: filters.topic_id,
            question_type: filters.question_type,
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            tags: filters.tags,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error searching questions:", error);
      return responseBuilder.serverError(res, "Failed to search questions");
    }
  }

  // إحصائيات الأسئلة
  async getQuestionsStats(req, res) {
    try {
      const stats = await questionsRepository.getQuestionsStats();
      return responseBuilder.success(res, {
        message: "Questions statistics retrieved successfully",
        stats,
      });
    } catch (error) {
      console.error("Error fetching questions stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch questions statistics"
      );
    }
  }

  // الأسئلة المتاحة للاختيار
  async getAvailableQuestions(req, res) {
    try {
      const questions = await questionsRepository.getAvailableQuestions(req.query || {});
      return responseBuilder.success(res, {
        message: "Available questions retrieved successfully",
        questions,
        count: questions.length,
      });
    } catch (error) {
      console.error("Error fetching available questions:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch available questions"
      );
    }
  }

  // تحديث حالة الموافقة على السؤال
  async updateQuestionStatus(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }
      const { status } = req.body || {};
      if (!status) {
        return responseBuilder.badRequest(res, "Status is required");
      }
      const updatedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const question = await questionsRepository.updateQuestionStatus(questionId, status, updatedBy);
      if (!question) {
        return responseBuilder.notFound(res, "Question not found");
      }
      return responseBuilder.success(res, {
        message: "Question status updated successfully",
        question,
      });
    } catch (error) {
      console.error("Error updating question approval:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update question approval"
      );
    }
  }

  // تحديث إحصائيات الاستخدام
  async updateQuestionUsage(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }
      const updatedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const question = await questionsRepository.updateQuestionUsage(questionId, req.body || {}, updatedBy);
      if (!question) {
        return responseBuilder.notFound(res, "Question not found");
      }
      return responseBuilder.success(res, {
        message: "Question usage updated successfully",
        question,
      });
    } catch (error) {
      console.error("Error updating question usage:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update question usage"
      );
    }
  }

  // رفع ملف أسئلة وإنشاءها
  async uploadQuestionsFromFile(req, res) {
    const startTime = Date.now();
    
    try {
      console.log("Upload request received:", {
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        hasBuffer: !!req.file?.buffer,
        hasPath: !!req.file?.path,
        hasBodyField: !!req.body?.questionsFile,
        bodyFieldLength: req.body?.questionsFile?.length,
        topicId: req.body?.topic_id
      });

      const createdBy = req.user?.admin_id || 1;
      const topicId = req.body.topic_id ? parseInt(req.body.topic_id) : null;
      
      // Parse questions from file - handle both file upload and text field
      const parseStartTime = Date.now();
      let parseResult;
      
      try {
        // Check if file was uploaded via multer (file upload)
        if (req.file) {
          // Use file path (disk storage)
          if (req.file.path && fs.existsSync(req.file.path)) {
            console.log("Parsing from uploaded file path:", req.file.path);
            parseResult = parseQuestionsFromText(req.file.path);
          } else if (req.file.buffer && Buffer.isBuffer(req.file.buffer)) {
            // Fallback to buffer if path is not available
            console.log("Parsing from uploaded file buffer (fallback)");
            parseResult = parseQuestionsFromText(req.file.buffer);
          } else {
            throw new Error("File not found. Neither path nor buffer is available.");
          }
        } 
        // Check if file content was sent as a text field (alternative method)
        else if (req.body && req.body.questionsFile && typeof req.body.questionsFile === 'string') {
          console.log("Parsing from text field (req.body.questionsFile)");
          // Convert string to buffer for parsing
          const fileBuffer = Buffer.from(req.body.questionsFile, 'utf8');
          parseResult = parseQuestionsFromText(fileBuffer);
        } 
        else {
          console.error("No file found in request");
          return responseBuilder.badRequest(res, {
            message: "No file uploaded. Please upload a .txt file with field name 'questionsFile' as a file upload, or send the file content as a text field.",
            received: {
              hasFile: !!req.file,
              hasBodyField: !!req.body?.questionsFile,
              bodyKeys: req.body ? Object.keys(req.body) : []
            }
          });
        }
      } catch (parseError) {
        console.error("Error parsing questions file:", parseError);
        console.error("Parse error stack:", parseError.stack);
        
        // Clean up uploaded file if it exists on disk
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn("Failed to clean up uploaded file after parse error:", cleanupError.message);
          }
        }
        
        return responseBuilder.badRequest(res, {
          message: `Failed to parse questions file: ${parseError.message}`,
          error: parseError.message
        });
      }
      
      const parseTime = Date.now() - parseStartTime;

      console.log(`Parsing completed in ${parseTime}ms: ${parseResult.successCount} questions, ${parseResult.errorCount} errors`);

      if (parseResult.errors.length > 0) {
        console.warn(`Parsing errors found: ${parseResult.errors.length} errors`);
        console.log("First few parsing errors:", parseResult.errors.slice(0, 3));
      }

      if (!parseResult.questions || parseResult.questions.length === 0) {
        console.log("No valid questions found in file");
        
        // Clean up uploaded file if it exists on disk
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn("Failed to clean up uploaded file:", cleanupError.message);
          }
        }
        
        return responseBuilder.badRequest(res, {
          message: "No valid questions found in the file",
          parsing_results: {
            total_lines: parseResult.totalLines || 0,
            parsing_errors: parseResult.errors || [],
            parsing_error_count: parseResult.errorCount || 0
          }
        });
      }

      // Log parsed questions details
      console.log(`Parsed ${parseResult.questions.length} questions successfully`);
      if (parseResult.questions.length > 0) {
        console.log("First parsed question sample:", {
          question_text: parseResult.questions[0].question_text?.substring(0, 50) + "...",
          question_type: parseResult.questions[0].question_type,
          difficulty_level: parseResult.questions[0].difficulty_level,
          has_options: !!parseResult.questions[0].options && parseResult.questions[0].options.length > 0,
          options_count: parseResult.questions[0].options?.length || 0,
          topic_id: parseResult.questions[0].topic_id,
          status: parseResult.questions[0].status
        });
      }

      // Add topic_id to all questions if provided
      if (topicId && !isNaN(topicId)) {
        for (let i = 0; i < parseResult.questions.length; i++) {
          parseResult.questions[i].topic_id = topicId;
        }
      }

      // Create questions in database
      const createStartTime = Date.now();
      let createResult;
      
      try {
        console.log(`Creating ${parseResult.questions.length} questions in database...`);
        createResult = await questionsRepository.createQuestionsFromFile(
          parseResult.questions,
          createdBy
        );
        console.log("Database creation completed:", {
          successCount: createResult.successCount,
          failureCount: createResult.failureCount
        });
      } catch (createError) {
        console.error("Error creating questions in database:", createError);
        console.error("Create error stack:", createError.stack);
        
        // Clean up uploaded file if it exists on disk
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn("Failed to clean up uploaded file after create error:", cleanupError.message);
          }
        }
        
        return responseBuilder.serverError(res, {
          message: `Failed to create questions in database: ${createError.message}`,
          error: createError.message
        });
      }
      
      const createTime = Date.now() - createStartTime;

      console.log(`Database creation completed in ${createTime}ms: ${createResult.successCount} created, ${createResult.failureCount} failed`);

      // Clean up uploaded file if it exists on disk
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn("Failed to clean up uploaded file:", cleanupError.message);
        }
      }

      const totalTime = Date.now() - startTime;

      // Prepare response with performance metrics
      const response = {
        message: `File processed successfully. ${createResult.successCount} questions created, ${createResult.failureCount} failed.`,
        performance_metrics: {
          total_processing_time_ms: totalTime,
          parsing_time_ms: parseTime,
          database_time_ms: createTime,
          questions_per_second: totalTime > 0 ? Math.round((createResult.successCount / totalTime) * 1000) : 0
        },
        file_info: {
          original_name: req.file.originalname,
          file_size: req.file.size,
          uploaded_at: new Date().toISOString()
        },
        topic_info: {
          topic_id: topicId,
          applied_to_all_questions: topicId ? true : false
        },
        parsing_results: {
          total_lines: parseResult.totalLines || 0,
          parsing_errors: parseResult.errors || [],
          parsing_error_count: parseResult.errorCount || 0
        },
        creation_results: {
          total_processed: createResult.totalProcessed || parseResult.questions.length,
          successful: createResult.successful || [],
          failed: createResult.failed || [],
          success_count: createResult.successCount || 0,
          failure_count: createResult.failureCount || 0
        }
      };

      if (createResult.successCount > 0) {
        return responseBuilder.success(res, response, 201);
      } else {
        return responseBuilder.badRequest(res, {
          message: "No questions could be created from the file",
          ...response
        });
      }

    } catch (error) {
      console.error("Error uploading questions file:", error);
      console.error("Error stack:", error.stack);
      
      // Clean up uploaded file if it exists on disk
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn("Failed to clean up uploaded file after error:", cleanupError.message);
        }
      }

      return responseBuilder.serverError(res, {
        message: `Failed to process questions file: ${error.message}`,
        error: error.message
      });
    }
  }

  // إحصائيات استخدام السؤال
  async getQuestionUsageStats(req, res) {
    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return responseBuilder.badRequest(res, "Invalid question ID");
      }
      const usageStats = await questionsRepository.getQuestionUsageStats(questionId);
      if (!usageStats) {
        return responseBuilder.notFound(res, "Question not found");
      }
      return responseBuilder.success(res, {
        message: "Question usage stats retrieved successfully",
        question_id: questionId,
        usage_stats: usageStats,
      });
    } catch (error) {
      console.error("Error fetching question usage stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch question usage statistics"
      );
    }
  }
}

module.exports = new QuestionsController();
