const express = require("express");
const auth = require("../../../../controllers/admin/auth/login");
const { requireAuth, attachUserIfPresent } = require("../../../../middlewares/jwt");
const router = express.Router();

// Login route (no auth required)
router.post("/login", async (req, res) => {
  await auth(req, res);
});

// Example of protected route that requires admin authentication
// router.get("/profile", requireAuth("admin"), async (req, res) => {
//   res.json({ user: req.user });
// });

// Example of route that optionally attaches user if token is present
// router.get("/optional", attachUserIfPresent("admin"), async (req, res) => {
//   res.json({ user: req.user || null });
// });

module.exports = router;
