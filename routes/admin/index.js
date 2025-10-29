const express = require("express");
const router = express.Router();

const { adminHome } = require("../../controllers/admin/overview");

router.get("/overview", adminHome);

module.exports = router;


