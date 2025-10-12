const express = require("express");
const router = express.Router();
const {
  login,
  register,
  profile,
  refreshToken,
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

module.exports = router;
