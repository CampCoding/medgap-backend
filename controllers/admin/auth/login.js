const loginRepo = require("../../../repositories/admin/auth/auth");
const responseBuilder = require("../../../utils/responsebuilder");

const createController = async (req, res) => {
  try {
    if (!req?.body?.admin_email || !req?.body?.admin_password) {
      return responseBuilder.badRequest(res, "Email or Password is Required");
    }
    const data = await loginRepo(req.body);

    if (typeof data === "string") {
      return responseBuilder.badRequest(res, data);
    }
    return responseBuilder.success(res, { message: "Logged In Successfully", data });
  } catch (error) {
    return responseBuilder.serverError(res, "Failed to login");
  }
};

module.exports = createController;
