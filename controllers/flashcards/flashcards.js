const responseBuilder = require("../../utils/responsebuilder");
const flashcardLibrariesRepository = require("../../repositories/flashcards/flashcard-libraries");
const flashcardsRepository = require("../../repositories/flashcards/flashcards");
const { validationResult } = require("express-validator");

class FlashcardsController {
  // --- Flashcard Libraries ---
  async getAllFlashcardLibraries(req, res) {
    try {
      const {
        difficulty_level,
        status,
        search,
        topic_id,
        limit = 10,
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
