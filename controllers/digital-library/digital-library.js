const responseBuilder = require("../../utils/responsebuilder");
const digitalLibraryRepository = require("../../repositories/digital-library/digital-library");
const { validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs");

class DigitalLibraryController {
  async getAllDigitalLibraryFiles(req, res) {
    try {
      const {
        topic_id,
        processing_status,
        approval_status,
        file_type,
        search,
        limit = 10,
        page = 1,
      } = req.query;

      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        topic_id: topic_id ? parseInt(topic_id) : undefined,
        processing_status,
        approval_status,
        file_type,
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

      // الحصول على الملفات والعدد الإجمالي
      const [files, totalCount] = await Promise.all([
        digitalLibraryRepository.getAllLibraryFiles(filters),
        digitalLibraryRepository.getLibraryFilesCount(filters),
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
        message: `Found ${totalCount} digital library files`,
        data: {
          message: `Found ${totalCount} digital library files`,
          files,
          count: files.length,
          filters: {
            topic_id: filters.topic_id,
            processing_status: filters.processing_status,
            approval_status: filters.approval_status,
            file_type: filters.file_type,
            search: filters.search,
          },
        },
        pagination: paginationData,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching digital library files:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch digital library files"
      );
    }
  }

  async getDigitalLibraryFileById(req, res) {
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return responseBuilder.badRequest(res, "Invalid file ID");
      }

      const file = await digitalLibraryRepository.getLibraryFileById(fileId);

      if (!file) {
        return responseBuilder.notFound(res, "Digital library file not found");
      }

      return responseBuilder.success(res, {
        message: "Digital library file retrieved successfully",
        file: file,
      });
    } catch (error) {
      console.error("Error fetching digital library file:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch digital library file"
      );
    }
  }

  async createDigitalLibraryFile(req, res) {
    try {
      return responseBuilder.success(
        res,
        {
          message: "Create digital library file - Coming soon",
          file: req.body,
        },
        201
      );
    } catch (error) {
      console.error("Error creating digital library file:", error);
      return responseBuilder.serverError(
        res,
        "Failed to create digital library file"
      );
    }
  }

  async updateDigitalLibraryFile(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Update digital library file - Coming soon",
        file_id: req.params.id,
      });
    } catch (error) {
      console.error("Error updating digital library file:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update digital library file"
      );
    }
  }

  async deleteDigitalLibraryFile(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Delete digital library file - Coming soon",
        file_id: req.params.id,
      });
    } catch (error) {
      console.error("Error deleting digital library file:", error);
      return responseBuilder.serverError(
        res,
        "Failed to delete digital library file"
      );
    }
  }

  async permanentDeleteDigitalLibraryFile(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Permanent delete digital library file - Coming soon",
        file_id: req.params.id,
      });
    } catch (error) {
      console.error("Error permanently deleting digital library file:", error);
      return responseBuilder.serverError(
        res,
        "Failed to permanently delete digital library file"
      );
    }
  }

  async updateFileProcessingStatus(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Update file processing status - Coming soon",
        file_id: req.params.id,
        status: req.body.status,
      });
    } catch (error) {
      console.error("Error updating file processing status:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update file processing status"
      );
    }
  }

  async updateFileApprovalStatus(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Update file approval status - Coming soon",
        file_id: req.params.id,
        status: req.body.status,
      });
    } catch (error) {
      console.error("Error updating file approval status:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update file approval status"
      );
    }
  }

  async viewBook(req, res) {
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return responseBuilder.badRequest(res, "Invalid file ID");
      }

      // الحصول على بيانات الملف أولاً
      const fileData = await digitalLibraryRepository.getLibraryFileById(
        fileId
      );

      if (!fileData) {
        return responseBuilder.notFound(res, "Digital library file not found");
      }

      // تحديث عداد المشاهدة
      const result = await digitalLibraryRepository.incrementViewCount(fileId);

      if (!result) {
        return responseBuilder.serverError(res, "Failed to update view count");
      }

      // بناء مسار الملف
      const filePath = path.join(
        __dirname,
        "../../uploads/books",
        fileData.file_name
      );

      // التحقق من وجود الملف
      if (!fs.existsSync(filePath)) {
        return responseBuilder.notFound(
          res,
          "Physical file not found on server"
        );
      }

      // تحديد نوع المحتوى
      const ext = path.extname(fileData.file_name).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case ".txt":
          contentType = "text/plain";
          break;
        case ".jpg":
        case ".jpeg":
          contentType = "image/jpeg";
          break;
        case ".png":
          contentType = "image/png";
          break;
      }

      // تعيين headers للعرض
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${fileData.original_name || fileData.file_name}"`
      );
      res.setHeader("Content-Length", fileData.file_size || 0);

      // إرسال الملف للعرض
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error viewing book:", error);
      return responseBuilder.serverError(res, "Failed to view book");
    }
  }

  async downloadBook(req, res) {
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return responseBuilder.badRequest(res, "Invalid file ID");
      }

      // الحصول على بيانات الملف أولاً
      const fileData = await digitalLibraryRepository.getLibraryFileById(
        fileId
      );

      if (!fileData) {
        return responseBuilder.notFound(res, "Digital library file not found");
      }

      // تحديث عداد التحميل
      const result = await digitalLibraryRepository.incrementDownloadCount(
        fileId
      );

      if (!result) {
        return responseBuilder.serverError(
          res,
          "Failed to update download count"
        );
      }

      // بناء مسار الملف
      const filePath = path.join(
        __dirname,
        "../../uploads/books",
        fileData.file_name
      );

      // التحقق من وجود الملف
      if (!fs.existsSync(filePath)) {
        return responseBuilder.notFound(
          res,
          "Physical file not found on server"
        );
      }

      // تحديد نوع المحتوى
      const ext = path.extname(fileData.file_name).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case ".txt":
          contentType = "text/plain";
          break;
        case ".jpg":
        case ".jpeg":
          contentType = "image/jpeg";
          break;
        case ".png":
          contentType = "image/png";
          break;
      }

      // تعيين headers للتحميل
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileData.original_name || fileData.file_name}"`
      );
      res.setHeader("Content-Length", fileData.file_size || 0);

      // إرسال الملف للتحميل
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading book:", error);
      return responseBuilder.serverError(res, "Failed to download book");
    }
  }

  async getDigitalLibraryStats(req, res) {
    try {
      const stats = await digitalLibraryRepository.getDigitalLibraryStats();

      return responseBuilder.success(res, {
        message: "Digital library statistics retrieved successfully",
        stats: stats,
      });
    } catch (error) {
      console.error("Error fetching digital library stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch digital library statistics"
      );
    }
  }

  async getAvailableBooks(req, res) {
    try {
      return responseBuilder.success(res, {
        message: "Available books (processed and approved) - Coming soon",
        books: [],
      });
    } catch (error) {
      console.error("Error fetching available books:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch available books"
      );
    }
  }

  async getMostViewedBooks(req, res) {
    try {
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit);

      const books = await digitalLibraryRepository.getMostViewedBooks(limitNum);

      return responseBuilder.success(res, {
        message: "Most viewed books retrieved successfully",
        books: books,
        count: books.length,
      });
    } catch (error) {
      console.error("Error fetching most viewed books:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch most viewed books"
      );
    }
  }

  async getRecentBooks(req, res) {
    try {
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit);

      const books = await digitalLibraryRepository.getRecentBooks(limitNum);

      return responseBuilder.success(res, {
        message: "Recent books retrieved successfully",
        books: books,
        count: books.length,
      });
    } catch (error) {
      console.error("Error fetching recent books:", error);
      return responseBuilder.serverError(res, "Failed to fetch recent books");
    }
  }

  // خدمة الملفات الفعلية
  async serveFile(req, res) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return responseBuilder.badRequest(res, "Filename is required");
      }

      // بناء مسار الملف
      const filePath = path.join(__dirname, "../../uploads/books", filename);

      // التحقق من وجود الملف
      if (!fs.existsSync(filePath)) {
        return responseBuilder.notFound(res, "File not found");
      }

      // تحديد نوع المحتوى
      const ext = path.extname(filename).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case ".txt":
          contentType = "text/plain";
          break;
        case ".jpg":
        case ".jpeg":
          contentType = "image/jpeg";
          break;
        case ".png":
          contentType = "image/png";
          break;
      }

      // تعيين headers
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

      // إرسال الملف
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving file:", error);
      return responseBuilder.serverError(res, "Failed to serve file");
    }
  }
}

module.exports = new DigitalLibraryController();
