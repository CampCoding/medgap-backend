const { insertLog } = require("./logs");

const response = ({
  status,
  message,
  data = null,
  userId = null,
  pagination = null,
  error = null,
  request = "/api",
  statusCode = 200,
}) => {
  const defaultPagination = {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  };

  let logLevel = "info";

  if (statusCode >= 400 && statusCode < 500) {
    logLevel = "warn";
  } else if (statusCode >= 500) {
    logLevel = "error";
  }

  try {
    insertLog({
      level: logLevel,
      message,
      userId,
      requestMethod: "N/A",
      requestUrl: request,
      additionalData: data,
      errorDetails: error,
      requestResponse: data,
      timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    // تجاهل أخطاء التسجيل لتجنب توقف النظام
    console.warn("Failed to insert log:", logError.message);
  }

  return {
    status,
    message,
    data,
    pagination: pagination || defaultPagination,
    error: error || null,
    timestamp: new Date().toISOString(),
  };
};

// دوال مساعدة للاستجابات المختلفة
const responseBuilder = {
  // استجابة نجاح
  success: (res, data, statusCode = 200, pagination = null) => {
    return res.status(statusCode).json(
      response({
        status: "success",
        message: data.message || "Operation completed successfully",
        data: data.data || data,
        pagination: pagination,
        statusCode,
        request: res.req?.path || "/api",
      })
    );
  },

  // خطأ في التحقق من البيانات
  validationError: (res, errors) => {
    return res.status(400).json(
      response({
        status: "error",
        message: "Validation failed",
        error: errors,
        statusCode: 400,
        request: res.req?.path || "/api",
      })
    );
  },

  // طلب غير صحيح
  badRequest: (res, message) => {
    return res.status(400).json(
      response({
        status: "error",
        message: message || "Bad request",
        statusCode: 400,
        request: res.req?.path || "/api",
      })
    );
  },

  // غير موجود
  notFound: (res, message) => {
    return res.status(404).json(
      response({
        status: "error",
        message: message || "Resource not found",
        statusCode: 404,
        request: res.req?.path || "/api",
      })
    );
  },

  // خطأ في الخادم
  serverError: (res, message) => {
    return res.status(500).json(
      response({
        status: "error",
        message: message || "Internal server error",
        statusCode: 500,
        request: res.req?.path || "/api",
      })
    );
  },

  // غير مصرح
  unauthorized: (res, message) => {
    return res.status(401).json(
      response({
        status: "error",
        message: message || "Unauthorized",
        statusCode: 401,
        request: res.req?.path || "/api",
      })
    );
  },

  // محظور
  forbidden: (res, message) => {
    return res.status(403).json(
      response({
        status: "error",
        message: message || "Forbidden",
        statusCode: 403,
        request: res.req?.path || "/api",
      })
    );
  },
};

module.exports = responseBuilder;
