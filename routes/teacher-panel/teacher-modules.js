const express = require("express");
const router = express.Router();
const {
  getModules
} = require("../../controllers/teacher-panel/teacher-modules");
const { verifyAccessToken } = require("../../utils/jwt");
const getTokenFromHeader = require("../../utils/getToken");
router.get("/list", (req, res, next) => {
  try {
    const token = getTokenFromHeader(req, res);
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "teacher");
    req.user = decoded;
    return getModules(req, res);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid token", error: err.message });
  }
});

module.exports = router;
