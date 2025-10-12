const express = require("express");
const createRole = require("../../../../controllers/admin/manage-users/create");
const updateController = require("../../../../controllers/admin/manage-users/update");
const { requireAuth } = require("../../../../middlewares/jwt");
const router = express.Router();
router.post("/create", requireAuth("admin"), async (req, res) => {
  await createRole(req, res);
});
router.put("/update", requireAuth("admin"), async (req, res) => {
  await updateController(req, res);
});

module.exports = router;
