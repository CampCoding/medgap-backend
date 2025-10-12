const responseBuilder = require("../../utils/responsebuilder");
const repo = require("../../repositories/admin/quotes");

// Get all quotes with pagination
async function getAllQuotes(req, res) {
  try {
    const { page = 1, limit = 20, search = "", category = "" } = req.query;
    const offset = (page - 1) * limit;

    const quotes = await repo.getAllQuotes({
      offset: parseInt(offset),
      limit: parseInt(limit),
      search,
      category,
    });

    return responseBuilder.success(res, {
      data: quotes,
      message: "Quotes retrieved successfully",
    });
  } catch (error) {
    console.error("Get quotes error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve quotes");
  }
}

// Get quote by ID
async function getQuoteById(req, res) {
  try {
    const { id } = req.params;
    const quote = await repo.getQuoteById(parseInt(id));

    if (!quote) {
      return responseBuilder.notFound(res, "Quote not found");
    }

    return responseBuilder.success(res, {
      data: quote,
      message: "Quote retrieved successfully",
    });
  } catch (error) {
    console.error("Get quote error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve quote");
  }
}

// Create new quote
async function createQuote(req, res) {
  // Admin ID is already available from middleware
  const adminId = req.user?.admin_id;

  const { quote_text, author, category = "motivation" } = req.body;

  if (!quote_text || !quote_text.trim()) {
    return responseBuilder.badRequest(res, "Quote text is required");
  }

  try {
    const newQuote = await repo.createQuote({
      quote_text: quote_text.trim(),
      author: author?.trim() || null,
      category: category.trim(),
      created_by: adminId,
    });

    return responseBuilder.success(res, {
      data: newQuote,
      message: "Quote created successfully",
    });
  } catch (error) {
    console.error("Create quote error:", error);
    return responseBuilder.serverError(res, "Failed to create quote");
  }
}

// Update quote
async function updateQuote(req, res) {
  // Admin ID is already available from middleware
  const adminId = req.user?.admin_id;

  const { id } = req.params;
  const { quote_text, author, category, is_active } = req.body;

  if (!quote_text || !quote_text.trim()) {
    return responseBuilder.badRequest(res, "Quote text is required");
  }

  try {
    const updated = await repo.updateQuote({
      quoteId: parseInt(id),
      quote_text: quote_text.trim(),
      author: author?.trim() || null,
      category: category?.trim() || "motivation",
      is_active: is_active !== undefined ? is_active : true,
      updated_by: adminId,
    });

    if (!updated) {
      return responseBuilder.notFound(res, "Quote not found");
    }

    return responseBuilder.success(res, {
      data: { updated: true },
      message: "Quote updated successfully",
    });
  } catch (error) {
    console.error("Update quote error:", error);
    return responseBuilder.serverError(res, "Failed to update quote");
  }
}

// Delete quote
async function deleteQuote(req, res) {
  // Admin ID is already available from middleware
  const adminId = req.user?.admin_id;

  const { id } = req.params;

  try {
    const deleted = await repo.deleteQuote(parseInt(id));

    if (!deleted) {
      return responseBuilder.notFound(res, "Quote not found");
    }

    return responseBuilder.success(res, {
      data: { deleted: true },
      message: "Quote deleted successfully",
    });
  } catch (error) {
    console.error("Delete quote error:", error);
    return responseBuilder.serverError(res, "Failed to delete quote");
  }
}

// Get quote categories
async function getQuoteCategories(req, res) {
  try {
    const categories = await repo.getQuoteCategories();

    return responseBuilder.success(res, {
      data: categories,
      message: "Quote categories retrieved successfully",
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return responseBuilder.serverError(res, "Failed to retrieve categories");
  }
}

module.exports = {
  getAllQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  getQuoteCategories,
};
