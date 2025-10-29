const { getOverview, getRecentActivity } = require("../../repositories/admin/overview");
const responseBuilder = require("../../utils/responsebuilder");

async function adminHome(req, res) {
  try {
    const [overview, recent] = await Promise.all([
      getOverview(),
      getRecentActivity(),
    ]);

    return responseBuilder.success(res, {
      overview,
      recentActivity: recent,
    });
  } catch (err) {
    return responseBuilder.serverError(res, "Failed to load overview");
  }
}

module.exports = { adminHome };


