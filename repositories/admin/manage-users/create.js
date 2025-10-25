const { client } = require("../../../config/db-connect");

const isMysql = true;

const createRepo = async (data) => {
  if (isMySQL) {
    const [result] = await client.execute(
      "INSERT INTO admins (admin_name, admin_email, admin_password, admin_phone, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, current_timestamp(), current_timestamp()) RETURNING *",
      [
        data?.admin_name,
        data?.admin_email,
        data?.admin_password,
        data?.admin_phone,
        data?.role_id
      ]
    );
    delete result?.[0]?.admin_password;
    return result?.[0];
  } else {
    const date = new Date();
    data.created_at = date;
    data.updated_at = date;
    const [result] = await client.query(
      "INSERT INTO admins (admin_name, admin_email, admin_password, admin_phone, role_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        data?.admin_name,
        data?.admin_email,
        data?.admin_password,
        data?.admin_phone,
        data?.role_id,
        data?.created_at,
        data?.updated_at
      ]
    );
    delete result?.[0]?.admin_password;

    return result?.[0];
  }
};

module.exports = createRepo;
