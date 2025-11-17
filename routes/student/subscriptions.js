const express = require("express");
const { requireAuth } = require("../../middlewares/jwt");
const { subscribeUsingCard } = require("../../controllers/student/subscriptions");

const router = express.Router();

router.post(
  "/redeem",
  requireAuth("student"),
  subscribeUsingCard
);

module.exports = router;

