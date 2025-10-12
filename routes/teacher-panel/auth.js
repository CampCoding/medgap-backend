const express = require("express");
const {
  login,
  profile,
  refreshToken
} = require("../../controllers/teacher-panel/authController");
const { verifyAccessToken, verifyRefreshToken } = require("../../utils/jwt");
const getTokenFromHeader = require("../../utils/getToken");
const router = express.Router();

router.post("/login", login);
router.get("/profile", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return; 
    const decoded = verifyAccessToken(token, "teacher");
    req.user = decoded; 
    return profile(req, res);
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: invalid token", error: err.message });
  }
});
router.get("/refresh-token", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return; 
    const decoded = verifyRefreshToken(token, "teacher");
    req.user = decoded; 
    return refreshToken(req, res);
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: invalid token", error: err.message });
  }
});


module.exports = router;
