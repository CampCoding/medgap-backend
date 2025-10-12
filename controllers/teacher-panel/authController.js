const login = async (req, res) => {
  const { loginRepo } = require("../../repositories/teacher-panel/auth");
  const responseBuilder = require("../../utils/responsebuilder");

  try {
    if (req.body?.email && req.body?.password) {
      const user = await loginRepo({ data: { ...req.body } });
      if (user) {
        return responseBuilder.success(res, { user });
      } else {
        return responseBuilder.notFound(res, "Account does not exist.");
      }
    } else {
      return responseBuilder.badRequest(
        res,
        "Email and password are required."
      );
    }
  } catch (error) {
    console.error("Login Error:", error);
    return responseBuilder.serverError(res, "An error occurred during login.");
  }
};

const profile = async (req, res) => {
  const responseBuilder = require("../../utils/responsebuilder");
  try {
    if (req.user?.user?.teacher_id) {
      const { profile } = require("../../repositories/teacher-panel/profile");
      const user = await profile(req?.user);
      if (!user) {
        return responseBuilder.notFound(res, "User not found.");
      }
      return responseBuilder.success(res, { user });
    }
    return responseBuilder.unauthorized(res, "Unauthorized access.");
  } catch (error) {
    console.error("Profile Error:", error);
    return responseBuilder.serverError(
      res,
      "An error occurred while fetching profile." + error.message
    );
  }
};


const refreshToken = async (req, res) => {
  const responseBuilder = require("../../utils/responsebuilder");
  try {
    if (req.user?.user?.teacher_id) {
      const { refreshToken } = require("../../repositories/teacher-panel/refresh-token");
      const user = await refreshToken(req?.user);
      if (!user) {
        return responseBuilder.notFound(res, "User not found.");
      }
      return responseBuilder.success(res, { user });
    }
    return responseBuilder.unauthorized(res, "Unauthorized access.");
  } catch (error) {
    console.error("Profile Error:", error);
    return responseBuilder.serverError(
      res,
      "An error occurred while refreshing token." + error.message
    );
  }
};

module.exports = {
  login,
  profile,
  refreshToken
};
