const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/teacher/dashboard");

function getTeacherId(req, res) {
  if (req.user && req.user.teacher_id) {
    return req.user.teacher_id;
  }
  return null;
}

async function getDashboardOverview(req, res) {
  const teacherId = getTeacherId(req, res);
  
  if (!teacherId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const overview = await repo.getTeacherDashboardOverview(teacherId);
    
    return responseBuilder.success(res, {
      data: overview,
      message: "Teacher dashboard overview retrieved successfully"
    });
  } catch (error) {
    console.error("Get teacher dashboard overview error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve dashboard overview");
  }
}

module.exports = {
  getDashboardOverview
};

