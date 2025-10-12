const teacherModulesRepo = require("../../repositories/teacher-panel/teacher-modules");

const getModules = async (req, res) => {
  const responseBuilder = require("../../utils/responsebuilder");
  try {
    console.log(req.user);
    if (req.user?.user?.teacher_id) {
      const modules = await teacherModulesRepo.getModules(req?.user);
      return responseBuilder.success(res, { modules });
    }
    return responseBuilder.unauthorized(res, "Unauthorized access.");
  } catch (error) {
    console.error("Get Modules Error:", error);
    return responseBuilder.serverError(
      res,
      "An error occurred while fetching modules." + error.message
    );
  }
};

module.exports = { getModules };
