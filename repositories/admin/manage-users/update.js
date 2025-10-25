const { client } = require("../../../config/db-connect");

const isMysql = true;

const updateRepo = async (data) => {
  const updateStmt = [];
  const date = new Date();
  data.created_at = date;
  data.updated_at = date;
  if (data?.admin_name) {
    updateStmt.push(`admin_name = '${data?.admin_name}'`);
  }
  // if (data?.admin_email) {
  //   updateStmt.push(`admin_email = '${data?.admin_email}'`);
  // }
  if (data?.admin_password) {
    updateStmt.push(`admin_password = '${data?.admin_password}'`);
  }
  // if (data?.admin_phone) {
  //   updateStmt.push(`admin_phone = '${data?.admin_phone}'`);
  // }
  if (data?.role_id) {
    updateStmt.push(`role_id = ${data?.role_id}`);
  }

  if (isMySQL) {
    const [result] = await client.execute(
      `UPDATE admins SET ${updateStmt.join(
        ", "
      )}, updated_at = ? WHERE admin_id = ?`,
      [data?.updated_at, data?.admin_id]
    );
    const [rows] = await client.execute(
      `SELECT * FROM admins LEFT JOIN roles ON roles.role_id = admins.role_id WHERE admin_id = ? LIMIT 1`,
      [data?.admin_id]
    );
    delete rows?.[0]?.admin_password;
    return rows?.[0];
  } else {
    const [result] = await client.query(
      `UPDATE admins SET ${updateStmt.join(
        ", "
      )}, updated_at = $1 WHERE admin_id = $2`,
      [data?.updated_at, data?.admin_id]
    );
    const [rows] = await client.query(
      `SELECT * FROM admins LEFT JOIN roles ON roles.role_id = admins.role_id WHERE admin_id = $1 LIMIT 1`,
      [data?.admin_id]
    );
    delete rows?.[0]?.admin_password;
    return rows?.[0];
  }
};

module.exports = updateRepo;
