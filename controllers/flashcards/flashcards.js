const responseBuilder = require("../../utils/responsebuilder");
const flashcardLibrariesRepository = require("../../repositories/flashcards/flashcard-libraries");
const flashcardsRepository = require("../../repositories/flashcards/flashcards");
const { validationResult } = require("express-validator");
const fs = require("fs");
const { parseFlashcardsFromText } = require("../../utils/flashcard-parser");

class FlashcardsController {
  // --- Flashcard Libraries ---
  async getAllFlashcardLibraries(req, res) {
    try {
      const {
        difficulty_level,
        status,
        search,
        topic_id,
        limit = 10000000000000000000,
        page = 1,
      } = req.query;

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        difficulty_level,
        status,
        topic_id: topic_id,
        search,
        limit: limitNum,
        offset: offset,
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على المكتبات والعدد الإجمالي
      const [libraries, totalCount] = await Promise.all([
        flashcardLibrariesRepository.getAllFlashcardLibraries(filters),
        flashcardLibrariesRepository.getFlashcardLibrariesCount(filters),
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
        message: `Found ${totalCount} flashcard libraries`,
        data: {
          message: `Found ${totalCount} flashcard libraries`,
          libraries,
          count: libraries.length,
          filters: {
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            search: filters.search,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching flashcard libraries:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch flashcard libraries"
      );
    }
  }

  async getFlashcardLibraryById(req, res) {
    try {
      const libraryId = parseInt(req.params.id);
      if (isNaN(libraryId)) {
        return responseBuilder.badRequest(res, "Invalid library ID");
      }

      const library =
        await flashcardLibrariesRepository.getFlashcardLibraryById(libraryId);

      if (!library) {
        return responseBuilder.notFound(res, "Flashcard library not found");
      }

      return responseBuilder.success(res, {
        message: "Flashcard library retrieved successfully",
        library: library,
      });
    } catch (error) {
      console.error("Error fetching flashcard library:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch flashcard library"
      );
    }
  }

  async createFlashcardLibrary(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const library = await flashcardLibrariesRepository.createFlashcardLibrary(
        req.body,
        createdBy
      );

      return responseBuilder.success(
        res,
        {
          message: "Flashcard library created successfully",
          library: library,
        },
        201
      );
    } catch (error) {
      console.error("Error creating flashcard library:", error);
      return responseBuilder.serverError(
        res,
        "Failed to create flashcard library"
      );
    }
  }

  async updateFlashcardLibrary(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const libraryId = parseInt(req.params.id);
      if (isNaN(libraryId)) {
        return responseBuilder.badRequest(res, "Invalid library ID");
      }

      const updatedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const library = await flashcardLibrariesRepository.updateFlashcardLibrary(
        libraryId,
        req.body,
        updatedBy
      );

      return responseBuilder.success(res, {
        message: "Flashcard library updated successfully",
        library: library,
      });
    } catch (error) {
      console.error("Error updating flashcard library:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update flashcard library"
      );
    }
  }

  async deleteFlashcardLibrary(req, res) {
    try {
      const libraryId = parseInt(req.params.id);
      if (isNaN(libraryId)) {
        return responseBuilder.badRequest(res, "Invalid library ID");
      }

      const result = await flashcardLibrariesRepository.deleteFlashcardLibrary(
        libraryId
      );

      if (!result) {
        return responseBuilder.notFound(res, "Flashcard library not found");
      }

      return responseBuilder.success(res, {
        message: "Flashcard library deleted successfully",
        library_id: libraryId,
      });
    } catch (error) {
      console.error("Error deleting flashcard library:", error);
      return responseBuilder.serverError(
        res,
        "Failed to delete flashcard library"
      );
    }
  }

  async getFlashcardsInLibrary(req, res) {
    try {
      const { id } = req.params;
      const {
        difficulty_level,
        status,
        search,
        limit = 10,
        topic_id,
        page = 1,
      } = req.query;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid library ID");
      }

      const libraryId = parseInt(id);
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      // التحقق من وجود المكتبة
      const library =
        await flashcardLibrariesRepository.getFlashcardLibraryById(libraryId);
      if (!library) {
        return responseBuilder.notFound(res, "Flashcard library not found");
      }

      const filters = {
        library_id: libraryId,
        difficulty_level,
        topic_id: topic_id,
        status,
        search,
        limit: limitNum,
        offset: offset,
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على البطاقات والعدد الإجمالي
      const [flashcards, totalCount] = await Promise.all([
        flashcardsRepository.getFlashcardsByLibraryId(libraryId, filters),
        flashcardsRepository.getFlashcardsCount(filters),
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
        message: `Found ${totalCount} flashcards in library "${library.library_name}"`,
        data: {
          message: `Found ${totalCount} flashcards in library "${library.library_name}"`,
          library: {
            library_id: library.library_id,
            library_name: library.library_name,
            description: library.description,
            difficulty_level: library.difficulty_level,
            estimated_time: library.estimated_time,
            status: library.status,
            cards_count: library.cards_count,
          },
          flashcards,
          count: flashcards.length,
          filters: {
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            search: filters.search,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching flashcards in library:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch flashcards in library"
      );
    }
  }

  async getFlashcardLibrariesStats(req, res) {
    try {
      const stats =
        await flashcardLibrariesRepository.getFlashcardLibrariesStats();

      return res.status(200).json({
        status: "success",
        message: "Flashcard libraries statistics retrieved successfully",
        data: {
          message: "Flashcard libraries statistics retrieved successfully",
          stats,
        },
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching flashcard libraries stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch flashcard libraries stats"
      );
    }
  }

  async uploadFlashcardsFromFile(req, res) {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return responseBuilder.badRequest(res, "No file uploaded. Please upload a .txt file.");
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const libraryId = req.body.library_id ? parseInt(req.body.library_id) : null;
      const topicId = req.body.topic_id ? parseInt(req.body.topic_id) : null;
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

      console.log(`Starting file processing: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`Serverless environment: ${isServerless ? 'Yes' : 'No'}`);

      // Parse flashcards from file (handle both file path and buffer)
      const parseStartTime = Date.now();
      let parseResult;

      if (isServerless) {
        // In serverless, file is in memory as buffer
        parseResult = parseFlashcardsFromText(req.file.buffer);
      } else {
        // In local development, file is on disk
        parseResult = parseFlashcardsFromText(req.file.path);
      }

      const parseTime = Date.now() - parseStartTime;

      console.log(`Parsing completed in ${parseTime}ms: ${parseResult.successCount} flashcards, ${parseResult.errorCount} errors`);

      if (parseResult.errors.length > 0) {
        console.warn(`Parsing errors found: ${parseResult.errors.length} errors`);
        console.log("First few parsing errors:", parseResult.errors.slice(0, 3));
      }

      if (parseResult.flashcards.length === 0) {
        console.log("No valid flashcards found in file");
        return responseBuilder.badRequest(res, "No valid flashcards found in the file");
      }

      // Debug: Log sample parsed flashcard
      console.log("Sample parsed flashcard:", {
        front_text: parseResult.flashcards[0].front_text?.substring(0, 100),
        back_text: parseResult.flashcards[0].back_text?.substring(0, 100),
        difficulty_level: parseResult.flashcards[0].difficulty_level,
        card_order: parseResult.flashcards[0].card_order,
        status: parseResult.flashcards[0].status
      });

      console.log("parseResult.flashcards[0]", parseResult.flashcards[0])

      // Add library_id and topic_id to all flashcards if provided
      if (libraryId && !isNaN(libraryId)) {
        parseResult.flashcards.forEach(flashcard => {
          flashcard.library_id = libraryId;
        });
      }
      
      if (topicId && !isNaN(topicId)) {
        parseResult.flashcards.forEach(flashcard => {
          flashcard.topic_id = topicId;
        });
      }

      // Create flashcards in database with optimized batch processing
      const createStartTime = Date.now();
      const createResult = await flashcardsRepository.createFlashcardsFromFile(
        parseResult.flashcards,
        createdBy
      );
      const createTime = Date.now() - createStartTime;

      console.log(`Database creation completed in ${createTime}ms: ${createResult.successCount} created, ${createResult.failureCount} failed`);

      // Clean up uploaded file (only in non-serverless environments)
      if (!isServerless && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn("Failed to clean up uploaded file:", cleanupError.message);
        }
      }

      const totalTime = Date.now() - startTime;

      // Prepare response with performance metrics
      const response = {
        message: `File processed successfully. ${createResult.successCount} flashcards created, ${createResult.failureCount} failed.`,
        performance_metrics: {
          total_processing_time_ms: totalTime,
          parsing_time_ms: parseTime,
          database_time_ms: createTime,
          flashcards_per_second: Math.round((createResult.successCount / totalTime) * 1000),
          environment: isServerless ? 'serverless' : 'local'
        },
        file_info: {
          original_name: req.file.originalname,
          file_size: req.file.size,
          uploaded_at: new Date().toISOString(),
          processing_method: isServerless ? 'memory' : 'disk'
        },
        library_info: {
          library_id: libraryId,
          applied_to_all_flashcards: libraryId ? true : false
        },
        topic_info: {
          topic_id: topicId,
          applied_to_all_flashcards: topicId ? true : false
        },
        parsing_results: {
          total_lines: parseResult.totalLines,
          parsing_errors: parseResult.errors,
          parsing_error_count: parseResult.errorCount
        },
        creation_results: {
          total_processed: createResult.totalProcessed,
          successful: createResult.successful,
          failed: createResult.failed,
          success_count: createResult.successCount,
          failure_count: createResult.failureCount
        }
      };

      if (createResult.successCount > 0) {
        return responseBuilder.success(res, response, 201);
      } else {
        return responseBuilder.badRequest(res, "No flashcards could be created from the file", response);
      }

    } catch (error) {
      console.error("Error uploading flashcards file:", error);

      // Clean up uploaded file if it exists (only in non-serverless environments)
      if (!isServerless && req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn("Failed to clean up uploaded file after error:", cleanupError.message);
        }
      }

      return responseBuilder.serverError(res, "Failed to process flashcards file");
    }
  }

  // --- Individual Flashcards ---
  async getAllFlashcards(req, res) {
    try {
      const {
        library_id,
        topic_id,
        difficulty_level,
        status,
        search,
        limit = 10,
        page = 1,
      } = req.query;

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        library_id: library_id ? parseInt(library_id) : undefined,
        topic_id: topic_id ? parseInt(topic_id) : undefined,
        difficulty_level,
        status,
        search,
        limit: limitNum,
        offset: offset,
      };
      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على البطاقات والعدد الإجمالي
      const [flashcards, totalCount] = await Promise.all([
        flashcardsRepository.getAllFlashcards(filters),
        flashcardsRepository.getFlashcardsCount(filters),
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
        message: `Found ${totalCount} flashcards`,
        data: {
          message: `Found ${totalCount} flashcards`,
          flashcards,
          count: flashcards.length,
          filters: {
            library_id: filters.library_id,
            topic_id: filters.topic_id,
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            search: filters.search,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      return responseBuilder.serverError(res, "Failed to fetch flashcards");
    }
  }

  async getFlashcardById(req, res) {
    try {
      const flashcardId = parseInt(req.params.id);
      if (isNaN(flashcardId)) {
        return responseBuilder.badRequest(res, "Invalid flashcard ID");
      }

      const flashcard = await flashcardsRepository.getFlashcardById(
        flashcardId
      );

      if (!flashcard) {
        return responseBuilder.notFound(res, "Flashcard not found");
      }

      return responseBuilder.success(res, {
        message: "Flashcard retrieved successfully",
        flashcard: flashcard,
      });
    } catch (error) {
      console.error("Error fetching flashcard:", error);
      return responseBuilder.serverError(res, "Failed to fetch flashcard");
    }
  }

  async createFlashcard(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const createdBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const flashcard = await flashcardsRepository.createFlashcard(
        req.body,
        createdBy
      );

      return responseBuilder.success(
        res,
        {
          message: "Flashcard created successfully",
          flashcard: flashcard,
        },
        201
      );
    } catch (error) {
      console.error("Error creating flashcard:", error);
      return responseBuilder.serverError(res, "Failed to create flashcard");
    }
  }

  async updateFlashcard(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const flashcardId = parseInt(req.params.id);
      if (isNaN(flashcardId)) {
        return responseBuilder.badRequest(res, "Invalid flashcard ID");
      }

      const updatedBy = req.user?.admin_id || 1; // TODO: Get from JWT
      const flashcard = await flashcardsRepository.updateFlashcard(
        flashcardId,
        req.body,
        updatedBy
      );

      return responseBuilder.success(res, {
        message: "Flashcard updated successfully",
        flashcard: flashcard,
      });
    } catch (error) {
      console.error("Error updating flashcard:", error);
      return responseBuilder.serverError(res, "Failed to update flashcard");
    }
  }

  async deleteFlashcard(req, res) {
    try {
      const flashcardId = parseInt(req.params.id);
      if (isNaN(flashcardId)) {
        return responseBuilder.badRequest(res, "Invalid flashcard ID");
      }

      const result = await flashcardsRepository.deleteFlashcard(flashcardId);

      if (!result) {
        return responseBuilder.notFound(res, "Flashcard not found");
      }

      return responseBuilder.success(res, {
        message: "Flashcard deleted successfully",
        flashcard_id: flashcardId,
      });
    } catch (error) {
      console.error("Error deleting flashcard:", error);
      return responseBuilder.serverError(res, "Failed to delete flashcard");
    }
  }
}

module.exports = new FlashcardsController();
