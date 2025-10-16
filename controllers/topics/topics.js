const topicsRepository = require("../../repositories/topics/topics");
const responseBuilder = require("../../utils/responsebuilder");
const { validationResult } = require("express-validator");

class TopicsController {
  // إنشاء موضوع جديد
  async createTopic(req, res) {
    try {
      // التحقق من صحة البيانات
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const {
        topic_name,
        short_description,
        learning_objectives,
        unit_id,
        status,
        tags,
        topic_order
      } = req.body;

      const topicData = {
        topic_name,
        short_description,
        learning_objectives,
        unit_id,
        status: status || "active",
        tags,
        topic_order,
        teacher_id: req.user?.user?.teacher_id
      };

      console.log("req.user", req.user?.user?.teacher_id)

      const createdBy = req.user ? req.user?.user?.teacher_id : null;
      const newTopic = await topicsRepository.createTopic(topicData, createdBy);

      return responseBuilder.success(
        res,
        {
          message: "Topic created successfully",
          topic: newTopic
        },
        201
      );
    } catch (error) {
      console.error("Error creating topic:", error);
      return responseBuilder.serverError(res, "Failed to create topic");
    }
  }

  // جميع الموضوعات
  async getAllTopics(req, res) {
    try {
      const { status, unit_id, search, tags, limit = 10, page = 1 } = req.query;

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;
      const filters = {
        status,
        unit_id: unit_id ? parseInt(unit_id) : undefined,
        teacher_id: req.user?.user?.teacher_id ? parseInt(req.user?.user?.teacher_id) : 0,
        search,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        limit: limitNum,
        offset: offset,

      };
 if(!filters?.teacher_id){
          delete filters?.teacher_id
      }
      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });
     

      // الحصول على البيانات والعدد الإجمالي
      const [topics, totalCount] = await Promise.all([
        topicsRepository.getAllTopics(filters),
        topicsRepository.getTopicsCount(filters)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages
      };

      return res.status(200).json({
        status: "success",
        message: "Topics retrieved successfully",
        data: {
          message: "Topics retrieved successfully",
          topics,
          count: topics.length,
          filters: {
            status: filters.status,
            unit_id: filters.unit_id,
            search: filters.search,
            tags: filters.tags
          }
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching topics:", error);
      return responseBuilder.serverError(res, "Failed to fetch topics");
    }
  }

  // موضوع بواسطة ID
  async getTopicById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid topic ID");
      }

      const topic = await topicsRepository.getTopicById(parseInt(id), parseInt(req?.user?.teacher_id));

      if (!topic) {
        return responseBuilder.notFound(res, "Topic not found");
      }

      return responseBuilder.success(res, {
        message: "Topic retrieved successfully",
        topic
      });
    } catch (error) {
      console.error("Error fetching topic:", error);
      return responseBuilder.serverError(res, "Failed to fetch topic");
    }
  }

  // تحديث بيانات موضوع
  async updateTopic(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid topic ID");
      }

      // تأكيد وجود الموضوع قبل التحديث
      const topicId = parseInt(id, 10);
      const exists = await topicsRepository.getTopicById(topicId);
      if (!exists) {
        return responseBuilder.notFound(res, "Topic not found");
      }

      // التحقق من صحة البيانات (إن وُجدت قواعد فحص)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      // الحقول المسموح بتحديثها فقط
      const allowed = [
        "topic_name",
        "short_description",
        "learning_objectives",
        "unit_id",
        "status",
        "tags",
        "topic_order"
      ];

      const patch = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          patch[key] = req.body[key];
        }
      }

      if (Object.keys(patch).length === 0) {
        return responseBuilder.badRequest(res, "No valid fields to update");
      }

      // تحويل القيم الرقمية
      if (patch.unit_id !== undefined && patch.unit_id !== null) {
        const u = Number(patch.unit_id);
        if (Number.isNaN(u)) {
          return responseBuilder.badRequest(res, "unit_id must be a number");
        }
        patch.unit_id = u;
      }

      if (patch.topic_order !== undefined && patch.topic_order !== null) {
        const o = Number(patch.topic_order);
        if (Number.isNaN(o)) {
          return responseBuilder.badRequest(
            res,
            "topic_order must be a number"
          );
        }
        patch.topic_order = o;
      }

      // تطبيع الوسوم tags
      if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
        if (Array.isArray(patch.tags)) {
          // ok
        } else if (typeof patch.tags === "string") {
          try {
            const parsed = JSON.parse(patch.tags);
            patch.tags = Array.isArray(parsed)
              ? parsed
              : patch.tags
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
          } catch {
            patch.tags = patch.tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        } else if (patch.tags === null) {
          // سيُحفظ NULL
        } else {
          return responseBuilder.badRequest(
            res,
            "tags must be an array, JSON array string, comma-separated string, or null"
          );
        }
      }

      const updatedBy = req.user ? req.user.admin_id : null;

      const updatedTopic = await topicsRepository.updateTopic(
        topicId,
        patch,
        updatedBy
      );

      if (!updatedTopic) {
        // احتياطياً إذا لم يؤثر التحديث على أي صف
        return responseBuilder.notFound(res, "Topic not found");
      }

      return responseBuilder.success(res, {
        message: "Topic updated successfully",
        topic: updatedTopic
      });
    } catch (error) {
      console.error("Error updating topic:", error);
      return responseBuilder.serverError(res, "Failed to update topic");
    }
  }

  // حذف موضوع (soft delete)
  async deleteTopic(req, res) {
    try {
      const { id } = req.params;

      const topic = await topicsRepository.deleteTopic(parseInt(id));

      return responseBuilder.success(res, {
        message: "Topic Deleted",
        topic_id: req.params.id
      });
    } catch (error) {
      console.error("Error deleting topic:", error);
      return responseBuilder.serverError(res, "Failed to delete topic");
    }
  }

  // حذف موضوع نهائياً
  async permanentDeleteTopic(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Permanent delete topic - Coming soon",
        topic_id: req.params.id
      });
    } catch (error) {
      console.error("Error permanently deleting topic:", error);
      return responseBuilder.serverError(
        res,
        "Failed to permanently delete topic"
      );
    }
  }

  // نسخ موضوع
  async duplicateTopic(req, res) {
    try {
     await topicsRepository.duplicateTopic({ ...req?.body, ...req?.params });
      return responseBuilder.success(res, {
        message: "Topic was duplicated successfully",
        topic_id: req.params.id
      });
    } catch (error) {
      console.error("Error duplicating topic:", error);
      return responseBuilder.serverError(res, "Failed to duplicate topic");
    }
  }

  // أسئلة الموضوع
  async getTopicQuestions(req, res) {
    try {
      const { id } = req.params;
      const {
        question_type,
        difficulty_level,
        status,
        limit = 10,
        page = 1
      } = req.query;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid topic ID");
      }

      const topicId = parseInt(id);
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      // التحقق من وجود الموضوع
      const topic = await topicsRepository.getTopicById(topicId);
      if (!topic) {
        return responseBuilder.notFound(res, "Topic not found");
      }

      const filters = {
        topic_id: topicId,
        question_type,
        difficulty_level,
        status,
        limit: limitNum,
        offset: offset
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على الأسئلة والعدد الإجمالي
      const questionsRepository = require("../../repositories/questions/questions");
      const [questions, totalCount] = await Promise.all([
        questionsRepository.getQuestionsByTopicId(topicId, filters),
        questionsRepository.getQuestionsCount(filters)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} questions for topic "${topic.topic_name}"`,
        data: {
          message: `Found ${totalCount} questions for topic "${topic.topic_name}"`,
          topic: {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            short_description: topic.short_description
          },
          questions,
          count: questions.length,
          filters: {
            question_type: filters.question_type,
            difficulty_level: filters.difficulty_level,
            status: filters.status
          }
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching topic questions:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch topic questions"
      );
    }
  }

  // البطاقات التعليمية للموضوع
  async getTopicFlashcards(req, res) {
    try {
      const { id } = req.params;
      const {
        difficulty_level,
        status,
        library_id,
        limit = 10,
        page = 1
      } = req.query;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid topic ID");
      }

      const topicId = parseInt(id);
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      // التحقق من وجود الموضوع
      const topic = await topicsRepository.getTopicById(topicId);
      if (!topic) {
        return responseBuilder.notFound(res, "Topic not found");
      }

      const filters = {
        topic_id: topicId,
        difficulty_level,
        status,
        library_id: library_id ? parseInt(library_id) : undefined,
        limit: limitNum,
        offset: offset
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على البطاقات والعدد الإجمالي
      const flashcardsRepository = require("../../repositories/flashcards/flashcards");
      const [flashcards, totalCount] = await Promise.all([
        flashcardsRepository.getFlashcardsByTopicId(topicId, filters),
        flashcardsRepository.getFlashcardsCount(filters)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} flashcards for topic "${topic.topic_name}"`,
        data: {
          message: `Found ${totalCount} flashcards for topic "${topic.topic_name}"`,
          topic: {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            short_description: topic.short_description
          },
          flashcards,
          count: flashcards.length,
          filters: {
            difficulty_level: filters.difficulty_level,
            status: filters.status,
            library_id: filters.library_id
          }
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching topic flashcards:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch topic flashcards"
      );
    }
  }

  // ملفات المكتبة الرقمية للموضوع
  async getTopicLibraryFiles(req, res) {
    try {
      const { id } = req.params;
      const {
        file_type,
        processing_status,
        approval_status,
        limit = 10,
        page = 1
      } = req.query;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid topic ID");
      }

      const topicId = parseInt(id);
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      // التحقق من وجود الموضوع
      const topic = await topicsRepository.getTopicById(topicId);
      if (!topic) {
        return responseBuilder.notFound(res, "Topic not found");
      }

      const filters = {
        topic_id: topicId,
        file_type,
        processing_status,
        approval_status, 
        limit: limitNum,
        offset: offset
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على الملفات والعدد الإجمالي
      const digitalLibraryRepository = require("../../repositories/digital-library/digital-library");
      const [libraryFiles, totalCount] = await Promise.all([
        digitalLibraryRepository.getLibraryFilesByTopicId(topicId, filters),
        digitalLibraryRepository.getLibraryFilesCount(filters)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} library files for topic "${topic.topic_name}"`,
        data: {
          message: `Found ${totalCount} library files for topic "${topic.topic_name}"`,
          topic: {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            short_description: topic.short_description
          },
          library_files: libraryFiles,
          count: libraryFiles.length,
          filters: {
            file_type: filters.file_type,
            processing_status: filters.processing_status,
            approval_status: filters.approval_status
          }
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching topic library files:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch topic library files"
      );
    }
  }

  // البحث في الموضوعات
  async searchTopics(req, res) {
    try {
      const {
        q: searchTerm,
        status,
        unit_id,
        tags,
        limit = 10,
        page = 1
      } = req.query;

      if (!searchTerm || searchTerm.trim() === "") {
        return responseBuilder.badRequest(res, "Search term is required");
      }

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        search: searchTerm.trim(),
        status,
        unit_id: unit_id ? parseInt(unit_id) : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        limit: limitNum,
        offset: offset
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      // الحصول على البيانات والعدد الإجمالي
      const [topics, totalCount] = await Promise.all([
        topicsRepository.getAllTopics(filters),
        topicsRepository.getTopicsCount(filters)
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const paginationData = {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages
      };

      return res.status(200).json({
        status: "success",
        message: `Found ${totalCount} topics matching "${searchTerm}"`,
        data: {
          message: `Found ${totalCount} topics matching "${searchTerm}"`,
          search_term: searchTerm,
          topics,
          count: topics.length,
          filters: {
            search: searchTerm,
            status: filters.status,
            unit_id: filters.unit_id,
            tags: filters.tags
          }
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error searching topics:", error);
      return responseBuilder.serverError(res, "Failed to search topics");
    }
  }

  // إحصائيات الموضوعات
  async getTopicsStats(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Topics statistics - Coming soon",
        stats: {
          total_topics: 0,
          active_topics: 0,
          inactive_topics: 0,
          draft_topics: 0
        }
      });
    } catch (error) {
      console.error("Error fetching topics stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch topics statistics"
      );
    }
  }

  // الموضوعات المتاحة للاختيار
  async getAvailableTopics(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Available topics - Coming soon",
        topics: []
      });
    } catch (error) {
      console.error("Error fetching available topics:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch available topics"
      );
    }
  }
}

module.exports = new TopicsController();
