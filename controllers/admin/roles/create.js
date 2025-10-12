const createRoleRepo = require("../../../repositories/admin/roles/create");
const response = require("../../../utils/responsebuilder");

const createRole = async (req, res) => {
  try {
    const data = await createRoleRepo(req.body);
    return res.status(201).send(
      response({
        status: "success",
        message: "Role created successfully",
        data,
        request: req?.path,
        statusCode: 201
      })
    );
  } catch (error) {
    return res.status(500).send(
      response({
        status: "error",
        message: "Failed to create role",
        error: error.message,
        request: req?.path,
        statusCode: 500,
        data: {}
      })
    );
  }
};

module.exports = createRole;
