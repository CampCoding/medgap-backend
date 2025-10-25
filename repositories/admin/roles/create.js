const { client } = require("../../../config/db-connect");

const isMysql = true;

const createRoleRepo = async (data) => {
  const name = data?.role_name ?? null;
  const desc = data?.role_description ?? null;

  if (isMySQL) {
    const [result] = await client.execute(
      "INSERT INTO roles (role_name, role_description) VALUES (?, ?) RETURNING *",
      [name, desc]
    );
    return result?.[0];
  } else {
    const { rows } = await client.query(
      "INSERT INTO roles (role_name, role_description) VALUES ($1, $2) RETURNING *",
      [name, desc]
    );
    return rows?.[0] || null;
  }
};

module.exports = createRoleRepo;
