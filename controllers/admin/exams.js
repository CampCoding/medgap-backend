const responseBuilder = require("../../utils/responsebuilder");
const { listAllExams } = require("../../repositories/admin/exams");

async function getAllExams(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      teacher_id,
      difficulty,
      free,
    } = req.query;

    const result = await listAllExams({
      page,
      limit,
      search,
      status,
      teacher_id,
      difficulty,
      free,
    });

    return responseBuilder.success(res, {
      message: "Exams fetched successfully",
      data: result.exams,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Admin get exams error:", error);
    return responseBuilder.serverError(res, "Failed to fetch exams");
  }
}

module.exports = {
  getAllExams,
};

