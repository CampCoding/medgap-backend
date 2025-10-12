const express = require("express");
const createRole = require("../../../../controllers/admin/roles/create");
const { requireAuth } = require("../../../../middlewares/jwt");
const router = express.Router();
router.post("/create",requireAuth("admin"), async (req, res) => {
  await createRole(req, res);
});

module.exports = router;
 