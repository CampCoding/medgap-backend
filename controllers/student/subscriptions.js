const responseBuilder = require("../../utils/responsebuilder");
const { redeemCardForStudent } = require("../../repositories/student/subscriptions");

const CODE_LENGTH = 14;

const isValidCode = (code = "") =>
  /^\d+$/.test(code) && code.length === CODE_LENGTH;

const subscribeUsingCard = async (req, res) => {
  try {
    const { code } = req.body || {};
    const studentId = req.user?.student_id || req.user?.id;

    if (!studentId) {
      return responseBuilder.unauthorized(res, "Student authentication required");
    }

    if (!code) {
      return responseBuilder.badRequest(res, "code is required");
    }

    if (!isValidCode(String(code).trim())) {
      return responseBuilder.badRequest(
        res,
        `code must be exactly ${CODE_LENGTH} digits`
      );
    }

    const { card, subscriptions, error, enrollments } = await redeemCardForStudent({
      studentId,
      code,
    });

    if (!card) {
      return responseBuilder.notFound(res, "Card not found for the provided code");
    }

    if (error === "inactive-card") {
      return responseBuilder.badRequest(res, "Card is inactive");
    }

    if (error === "card-expired") {
      return responseBuilder.badRequest(res, "Card has expired");
    }

    if (error === "no-resources") {
      // Include card details in error for debugging
      const debugInfo = card ? {
        card_type: card.type,
        source_type: typeof card.source,
        source_value: card.source,
        source_stringified: JSON.stringify(card.source)
      } : null;
      
      return responseBuilder.badRequest(
        res,
        `Card does not contain any resource IDs to activate. Card type: ${card?.type || 'unknown'}, Source: ${JSON.stringify(card?.source || {})}`
      );
    }

    const responseData = {
      card_id: card.card_id,
      code: card.code,
      type: card.type,
      end_date: card.end_date,
      resources: subscriptions,
    };

    // Include enrollments if it's a module type card
    if (card.type === "module" && enrollments) {
      responseData.enrollments = enrollments;
    }

    return responseBuilder.success(
      res,
      {
        message: "Subscription activated",
        data: responseData,
      },
      201
    );
  } catch (error) {
    console.error("Failed to subscribe using card", error);
    return responseBuilder.serverError(res, "Failed to subscribe using card");
  }
};

module.exports = {
  subscribeUsingCard,
};

