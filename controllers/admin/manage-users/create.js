const createRepo = require("../../../repositories/admin/manage-users/create");
const response = require("../../../utils/responsebuilder");

const createController = async (req, res) => {
  try {
    const bcrypt = require("bcrypt");
    const saltRounds = 10;
    const myPlaintextPassword = req.body?.admin_password;
    const hash = await bcrypt.hash(myPlaintextPassword, saltRounds);
    req.body.admin_password = hash;
    const data = await createRepo(req.body);
    return res.status(201).send(
      response({
        status: "success",
        message: "Admin created successfully",
        data,
        request: req?.path,
        statusCode: 201
      })
    );
  } catch (error) {
    return res.status(500).send(
      response({
        status: "error",
        message: "Failed to create Admin",
        error: error.message,
        request: req?.path,
        statusCode: 500,
        data: {}
      })
    );
  }
};

module.exports = createController;
