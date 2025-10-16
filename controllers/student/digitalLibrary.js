const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/digitalLibrary");
const getTokenFromHeader = require("../../utils/getToken");
const { verifyAccessToken } = require("../../utils/jwt");

function getStudentId(req, res) {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token) return null;
    const decoded = verifyAccessToken(token, "student");
    return decoded?.id || decoded?.student_id || decoded?.user?.student_id;
  } catch (err) {
    return null;
  }
}

async function listStudentModules(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  try {
    const modules = await repo.getStudentModules({ studentId });
    // Attach counts per module
    const withCounts = await Promise.all(
      modules.map(async (m) => ({
        ...m,
        books_count: await repo.countApprovedBooksByModule({
          moduleId: m.module_id,
        }),
      }))
    );
    return responseBuilder.success(res, {
      data: withCounts,
      message: "Student modules retrieved successfully",
    });
  } catch (error) {
    return responseBuilder.serverError(res, "Failed to get student modules");
  }
}
async function listModuleBooks(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { module_id } = req.params;
  const { page = 1, limit = 1200, search = "", ebook_id } = req.query;
  try {
    const result = await repo.listBooksByModule({
      moduleId: Number(module_id),
      page: Number(page),
      limit: Number(limit),
      search,
      studentId
    });
    // selected_book: إن كان ebook_id موجود هنبحث عنه داخل نفس القائمة أولاً، ولو مش موجود نجيبه من التفاصيل
    let selected = null;
    if (ebook_id) {
      selected =
        result.data.find((b) => Number(b.ebook_id) === Number(ebook_id)) ||
        null;
      if (!selected) {
        selected = await repo.getBookDetails({ ebookId: Number(ebook_id) });
      }
    }
    return responseBuilder.success(res, {
      data: {
        list: result,
        selected_book: selected,
      },
      message: "Module books retrieved successfully",
    });
  } catch (error) {
    return responseBuilder.serverError(res, "Failed to get module books");
  }
}
async function listBooksByModuleByBulk(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { module_id } = req.params;
  const { page = 1, limit = 1200, search = "", ebook_id } = req.query;
  try {
    const result = await repo.listBooksByModuleByBulk({
      moduleId: JSON.parse(module_id),
      page: Number(page),
      limit: Number(limit),
      search,
      studentId
    });
    // selected_book: إن كان ebook_id موجود هنبحث عنه داخل نفس القائمة أولاً، ولو مش موجود نجيبه من التفاصيل
    let selected = null;
    if (ebook_id) {
      selected =
        result.data.find((b) => Number(b.ebook_id) === Number(ebook_id)) ||
        null;
      if (!selected) {
        selected = await repo.getBookDetails({ ebookId: Number(ebook_id) });
      }
    }
    return responseBuilder.success(res, {
      data: {
        list: result,
        selected_book: selected,
      },
      message: "Module books retrieved successfully",
    });
  } catch (error) {
    return responseBuilder.serverError(res, "Failed to get module books");
  }
}

// getBook merged into listModuleBooks via query ebook_id

async function viewBook(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { ebook_id } = req.params;
  try {
    const updated = await repo.incrementView({ ebookId: Number(ebook_id) });
    if (!updated)
      return responseBuilder.notFound(res, "Book not found or inactive");
    return responseBuilder.success(res, {
      data: updated,
      message: "View count incremented",
    });
  } catch (error) {
    console.error("Increment view error:", error);
    return responseBuilder.serverError(res, "Failed to increment view");
  }
}

async function saveAnnotation(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }
  const { ebook_id } = req.params;
  const { ann_value } = req.body;
  if (!ann_value || !String(ann_value).trim()) {
    return responseBuilder.badRequest(res, "ann_value is required");
  }
  try {
    const created = await repo.saveAnnotation({
      annValue: String(ann_value),
      bookId: Number(ebook_id),
      studentId: Number(studentId),
    });
    return responseBuilder.success(res, {
      data: created,
      message: "Annotation saved",
    });
  } catch (error) {
    console.error("Save annotation error:", error);
    return responseBuilder.serverError(res, "Failed to save annotation");
  }
}

module.exports = {
  listStudentModules,
  listModuleBooks,
  viewBook,
  saveAnnotation,
  listBooksByModuleByBulk
};
