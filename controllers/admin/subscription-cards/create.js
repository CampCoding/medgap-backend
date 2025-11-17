const responseBuilder = require("../../../utils/responsebuilder");
const { createSubscriptionCards } = require("../../../repositories/admin/subscription-cards/create");

const ALLOWED_TYPES = ["book", "topic", "exam"];
const ALLOWED_STATUS = ["active", "inactive"];

const normalizeCode = (code) => {
  return code.trim().replace(/\s+/g, "-").toUpperCase();
};

const buildCodes = (baseCode, quantity) => {
  if (quantity === 1) return [baseCode];

  return Array.from({ length: quantity }, (_, idx) => {
    const suffix = String(idx + 1).padStart(3, "0");
    return `${baseCode}-${suffix}`;
  });
};

const parseSource = (source) => {
  if (typeof source === "string") {
    return JSON.parse(source);
  }
  return source;
};

const createSubscriptionCardsController = async (req, res) => {
  try {
    const {
      code,
      type,
      end_date,
      status = "active",
      source,
      number_of_cards,
      quantity,
    } = req.body || {};

    if (!code || !type || !end_date || source === undefined) {
      return responseBuilder.badRequest(
        res,
        "code, type, end_date, source are required"
      );
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return responseBuilder.badRequest(res, "Invalid subscription type");
    }

    if (!ALLOWED_STATUS.includes(status)) {
      return responseBuilder.badRequest(res, "Invalid status value");
    }

    const cardsCount = Number(
      Number.isInteger(number_of_cards)
        ? number_of_cards
        : number_of_cards ?? quantity ?? 1
    );

    if (!Number.isInteger(cardsCount) || cardsCount < 1 || cardsCount > 500) {
      return responseBuilder.badRequest(
        res,
        "number_of_cards must be an integer between 1 and 500"
      );
    }

    let parsedSource;
    try {
      parsedSource = parseSource(source);
    } catch (err) {
      return responseBuilder.badRequest(res, "source must be a valid JSON value");
    }

    if (
      typeof parsedSource !== "object" ||
      parsedSource === null ||
      (Array.isArray(parsedSource) && parsedSource.length === 0)
    ) {
      return responseBuilder.badRequest(
        res,
        "source must be a non-empty object or array"
      );
    }

    const normalizedCode = normalizeCode(code);
    const codes = buildCodes(normalizedCode, cardsCount);

    const createdCards = await createSubscriptionCards({
      codes,
      type,
      endDate: end_date,
      status,
      source: parsedSource,
    });

    return responseBuilder.success(res, {
      message: `${createdCards.length} subscription card(s) created`,
      data: createdCards,
    }, 201);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return responseBuilder.badRequest(res, "Duplicate card code detected");
    }

    console.error("Failed to create subscription cards", error);
    return responseBuilder.serverError(
      res,
      "Failed to create subscription cards"
    );
  }
};

module.exports = {
  createSubscriptionCardsController,
};

