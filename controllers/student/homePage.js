const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/student/homePage");
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

// Get complete home page data
async function getHomePage(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const homePageData = await repo.getHomePageData(studentId);

    return responseBuilder.success(res, {
      data: homePageData,
      message: "Home page data retrieved successfully",
    });
  } catch (error) {
    console.error("Get home page error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve home page data"
    );
  }
}

// Get daily quote only
async function getDailyQuote(req, res) {
  try {
    const quote = await repo.getDailyQuote();

    return responseBuilder.success(res, {
      data: { quote },
      message: "Daily quote retrieved successfully",
    });
  } catch (error) {
    console.error("Get daily quote error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve daily quote");
  }
}

// Get student streak
async function getStudentStreak(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const streak = await repo.getStudentStreak(studentId);

    return responseBuilder.success(res, {
      data: { streak },
      message: "Student streak retrieved successfully",
    });
  } catch (error) {
    console.error("Get student streak error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve student streak"
    );
  }
}

// Get today's activity (automatic from logs)
async function getTodayActivity(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const activity = await repo.getTodayActivity(studentId);

    return responseBuilder.success(res, {
      data: { activity },
      message: "Today's activity retrieved successfully",
    });
  } catch (error) {
    console.error("Get today's activity error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve today's activity"
    );
  }
}

// Get daily plan progress
async function getDailyPlanProgress(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const progress = await repo.getDailyPlanProgress(studentId);

    return responseBuilder.success(res, {
      data: { progress },
      message: "Daily plan progress retrieved successfully",
    });
  } catch (error) {
    console.error("Get daily plan progress error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve daily plan progress"
    );
  }
}

// Get continue where left off
async function getContinueWhereLeftOff(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const plans = await repo.getContinueWhereLeftOff(studentId);

    return responseBuilder.success(res, {
      data: { plans },
      message: "Continue where left off retrieved successfully",
    });
  } catch (error) {
    console.error("Get continue where left off error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve continue where left off"
    );
  }
}

// Get subject performance
async function getSubjectPerformance(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const performance = await repo.getSubjectPerformance(studentId);

    return responseBuilder.success(res, {
      data: { performance },
      message: "Subject performance retrieved successfully",
    });
  } catch (error) {
    console.error("Get subject performance error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve subject performance"
    );
  }
}

// Get weak topics focus
async function getWeakTopicsFocus(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const weakTopics = await repo.getWeakTopicsFocus(studentId);

    return responseBuilder.success(res, {
      data: { weakTopics },
      message: "Weak topics focus retrieved successfully",
    });
  } catch (error) {
    console.error("Get weak topics focus error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve weak topics focus"
    );
  }
}

// Get group leaderboard
async function getGroupLeaderboard(req, res) {
  try {
    const leaderboard = await repo.getGroupLeaderboard();

    return responseBuilder.success(res, {
      data: { leaderboard },
      message: "Group leaderboard retrieved successfully",
    });
  } catch (error) {
    console.error("Get group leaderboard error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve group leaderboard"
    );
  }
}

// Get recent activity
async function getRecentActivity(req, res) {
  try {
    const activities = await repo.getRecentActivity();

    return responseBuilder.success(res, {
      data: { activities },
      message: "Recent activity retrieved successfully",
    });
  } catch (error) {
    console.error("Get recent activity error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve recent activity"
    );
  }
}

// Get student recent activities
async function getStudentRecentActivities(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const activities = await repo.getStudentRecentActivities(studentId);

    return responseBuilder.success(res, {
      data: { activities },
      message: "Student recent activities retrieved successfully",
    });
  } catch (error) {
    console.error("Get student recent activities error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve student recent activities"
    );
  }
}

// Get student points
async function getStudentPoints(req, res) {
  const studentId = getStudentId(req, res);
  if (!studentId) {
    return responseBuilder.unauthorized(res, "Unauthorized: invalid token");
  }

  try {
    const points = await repo.getStudentPoints(studentId);

    return responseBuilder.success(res, {
      data: { points },
      message: "Student points retrieved successfully",
    });
  } catch (error) {
    console.error("Get student points error:", error);
    return responseBuilder.serverError(
      res,
      "Failed to retrieve student points"
    );
  }
}

module.exports = {
  getHomePage,
  getDailyQuote,
  getStudentStreak,
  getTodayActivity,
  getDailyPlanProgress,
  getContinueWhereLeftOff,
  getSubjectPerformance,
  getWeakTopicsFocus,
  getGroupLeaderboard,
  getRecentActivity,
  getStudentRecentActivities,
  getStudentPoints,
};
