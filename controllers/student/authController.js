const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/auth");
const getTokenFromHeader = require("../../utils/getToken");
const { verifyAccessToken, verifyRefreshToken, signAccessToken, signRefreshToken } = require("../../utils/jwt");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return responseBuilder.badRequest(res, "Email and password are required");
    }

    const user = await repo.loginRepo({ data: { email, password } });

    if (!user) {
      return responseBuilder.unauthorized(res, "Invalid email or password");
    }

    return responseBuilder.success(res, {
      data: user,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    return responseBuilder.serverError(res, "Login failed");
  }
};

const register = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      date_of_birth,
      gender,
      address,
    } = req.body;

    if (!full_name || !email || !password) {
      return responseBuilder.badRequest(
        res,
        "Full name, email, and password are required"
      );
    }

    if (password.length < 6) {
      return responseBuilder.badRequest(
        res,
        "Password must be at least 6 characters long"
      );
    }

    const result = await repo.registerRepo({
      data: {
        ...req.body,
        full_name,
        email,
        password,
        phone,
        date_of_birth,
        gender,
        address,
      },
    });

    return responseBuilder.success(res, {
      data: result,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.message === "Email already exists") {
      return responseBuilder.badRequest(res, "Email already exists");
    }
    return responseBuilder.serverError(res, "Registration failed");
  }
};

const profile = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?.student_id;

    if (!studentId) {
      return responseBuilder.unauthorized(res, "Student ID not found");
    }

    const user = await repo.getProfileRepo({ studentId });

    if (!user) {
      return responseBuilder.notFound(res, "Student not found");
    }

    return responseBuilder.success(res, {
      data: user,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    console.error("Profile error:", error);
    return responseBuilder.serverError(res, "Failed to get profile");
  }
};

const refreshToken = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?.student_id;

    if (!studentId) {
      return responseBuilder.unauthorized(res, "Student ID not found");
    }

    const user = await repo.getProfileRepo({ studentId });

    if (!user) {
      return responseBuilder.notFound(res, "Student not found");
    }

    const { signAccessToken, signRefreshToken } = require("../../utils/jwt");
    const access = signAccessToken(
      {
        id: user.student_id,
        user: user,
      },
      "student"
    );

    const refresh = signRefreshToken(
      {
        id: user.student_id,
        user: user,
      },
      "student"
    );

    return responseBuilder.success(res, {
      data: {
        access,
        refresh,
        user,
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return responseBuilder.serverError(res, "Failed to refresh token");
  }
};

const updateProfile = async (req, res) => {
  try {
    const { student_id, ...profileData } = req.body;
    
    if (!student_id) {
      return responseBuilder.badRequest(res, "Student ID is required");
    }
    
    const result = await repo.updateProfileRepo({ 
      studentId: student_id, 
      data: profileData 
    });
    
    if (!result.success) {
      return responseBuilder.badRequest(res, result.message);
    }
    
    return responseBuilder.success(res, {
      data: result,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return responseBuilder.serverError(res, "Failed to update profile");
  }
};

const addModules = async (req, res) => {
  try {
    const { student_id, modules } = req.body;
    
    if (!student_id) {
      return responseBuilder.badRequest(res, "Student ID is required");
    }
    
    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return responseBuilder.badRequest(res, "Valid modules array is required");
    }
    
    const result = await repo.addStudentModulesRepo({ 
      studentId: student_id, 
      modules 
    });
    
    if (!result.success) {
      return responseBuilder.badRequest(res, result.message);
    }
    
    return responseBuilder.success(res, {
      data: result,
      message: "Modules added successfully",
    });
  } catch (error) {
    console.error("Add modules error:", error);
    return responseBuilder.serverError(res, "Failed to add modules");
  }
};

const deleteModule = async (req, res) => {
  try {
    const { student_id } = req.body;
    
    if (!student_id) {
      return responseBuilder.badRequest(res, "Student ID is required");
    }
    
    const { moduleId } = req.params;
    
    if (!moduleId) {
      return responseBuilder.badRequest(res, "Module ID is required");
    }
    
    const result = await repo.deleteStudentModuleRepo({ 
      studentId: student_id, 
      moduleId 
    });
    
    if (!result.success) {
      return responseBuilder.badRequest(res, result.message);
    }
    
    return responseBuilder.success(res, {
      data: result,
      message: "Module removed successfully",
    });
  } catch (error) {
    console.error("Delete module error:", error);
    return responseBuilder.serverError(res, "Failed to delete module");
  }
};

module.exports = {
  login,
  register,
  profile,
  refreshToken,
  updateProfile,
  addModules,
  deleteModule,
};
