const updateRepo = require("../../../repositories/admin/manage-users/update");
const response = require("../../../utils/responsebuilder");

const updateController = async (req, res) => {
  try {
    const data = await updateRepo(req.body);

    if (data?.admin_password) {
      const bcrypt = require("bcrypt");
      const saltRounds = 10;
      const myPlaintextPassword = data?.admin_password;
      const hash = await bcrypt.hash(myPlaintextPassword, saltRounds);
      data.admin_password = hash;
    }
    return res.status(200).send(
      response({
        status: "success",
        message: "Admin updated successfully",
        data,
        request: req?.path,
        statusCode: 200
      })
    );
  } catch (error) {
    return res.status(500).send(
      response({
        status: "error",
        message: "Failed to update Admin",
        error: error.message,
        request: req?.path,
        statusCode: 500,
        data: {}
      })
    );
  }
};

module.exports = updateController;
