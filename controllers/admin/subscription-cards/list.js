const responseBuilder = require("../../../utils/responsebuilder");
const {
  listSubscriptionCards,
} = require("../../../repositories/admin/subscription-cards/create");

const ALLOWED_TYPES = ["book", "topic", "exam"];
const ALLOWED_STATUS = ["active", "inactive"];

const listSubscriptionCardsController = async (req, res) => {
  try {
    const { type, status, resource_id: resourceIdParam } = req.query;

    if (type && !ALLOWED_TYPES.includes(type)) {
      return responseBuilder.badRequest(res, "Invalid subscription type");
    }

    if (status && !ALLOWED_STATUS.includes(status)) {
      return responseBuilder.badRequest(res, "Invalid status value");
    }

    let resourceId;
    if (resourceIdParam !== undefined) {
      const parsedId = Number(resourceIdParam);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        return responseBuilder.badRequest(
          res,
          "resource_id must be a positive number"
        );
      }
      resourceId = parsedId;
    }

    const cards = await listSubscriptionCards({
      type,
      status,
      resourceId,
    });

    return responseBuilder.success(
      res,
      {
        message: "Subscription cards fetched successfully",
        data: cards,
      },
      200
    );
  } catch (error) {
    console.error("Failed to list subscription cards", error);
    return responseBuilder.serverError(
      res,
      "Failed to list subscription cards"
    );
  }
};

module.exports = {
  listSubscriptionCardsController,
};

