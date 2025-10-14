const express = require("express");
const router = express.Router();
const {
  login,
  register,
  profile,
  refreshToken,
  updateProfile,
  addModules,
  deleteModule,
} = require("../../controllers/student/authController");
const { verifyAccessToken, verifyRefreshToken } = require("../../utils/jwt");
const getTokenFromHeader = require("../../utils/getToken");

// Public routes
router.post("/login", login);
router.post("/register", register);

// Protected routes
router.get("/profile", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "student");
    req.user = decoded;
    return profile(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

router.get("/refresh-token", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const decoded = verifyRefreshToken(token, "student");

    req.user = decoded;
    return refreshToken(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

// Update profile route
router.put("/profile", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "student");
    req.user = decoded;
    return updateProfile(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

// Module management routes
router.post("/modules", (req, res, next) => {
  try {
 
    return addModules(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

router.delete("/modules/:moduleId", (req, res, next) => {
  try {
 
    return deleteModule(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

module.exports = router;
