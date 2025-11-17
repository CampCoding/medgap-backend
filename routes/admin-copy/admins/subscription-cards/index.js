const express = require("express");
const { requireAuth } = require("../../../../middlewares/jwt");
const {
  createSubscriptionCardsController,
} = require("../../../../controllers/admin/subscription-cards/create");
const {
  listSubscriptionCardsController,
} = require("../../../../controllers/admin/subscription-cards/list");

const router = express.Router();

router.post(
  "/create",
  requireAuth("admin"),
  createSubscriptionCardsController
);

router.get("/", requireAuth("admin"), listSubscriptionCardsController);

module.exports = router;

