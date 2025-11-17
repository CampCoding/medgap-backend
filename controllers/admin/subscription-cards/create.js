const responseBuilder = require("../../../utils/responsebuilder");
const { createSubscriptionCards } = require("../../../repositories/admin/subscription-cards/create");

const ALLOWED_TYPES = ["book", "topic", "exam"];
const ALLOWED_STATUS = ["active", "inactive"];
const CODE_LENGTH = 14;

const generateRandomCode = () => {
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH - 1;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(randomNumber);
};

const generateCodes = (quantity) => {
  const codes = new Set();
  while (codes.size < quantity) {
    codes.add(generateRandomCode());
  }
  return Array.from(codes);
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
      type,
      end_date,
      status = "active",
      source,
      number_of_cards,
      quantity,
    } = req.body || {};

    if (!type || !end_date || source === undefined) {
      return responseBuilder.badRequest(
        res,
        "type, end_date, source are required"
      );
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return responseBuilder.badRequest(res, "Invalid subscription type");
    }

    if (!ALLOWED_STATUS.includes(status)) {
      return responseBuilder.badRequest(res, "Invalid status value");
    }

    const rawCount =
      number_of_cards !== undefined ? number_of_cards : quantity;

    if (rawCount === undefined) {
      return responseBuilder.badRequest(
        res,
        "number_of_cards (or quantity) is required"
      );
    }

    const cardsCount = Number(rawCount);

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

    const codes = generateCodes(cardsCount);

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

