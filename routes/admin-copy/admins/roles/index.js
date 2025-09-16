const express = require("express");
const router = express.Router();
const client = require("../../../../config/db-connect")?.client;
router.post("/create", async (req, res) => {
  const { role_name, role_description } = req.body;
  const [data] = await client.query(
    "INSERT INTO roles (role_name, role_description) VALUES (?, ?) RETURNING *",
    [role_name, role_description]
  );
  console.log(data)
  res.json({
    message: "Role created successfully",
    data: data?.[0] || null
  });
});

module.exports = router;
