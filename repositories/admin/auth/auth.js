const { client } = require("../../../config/db-connect");
const { signAccessToken, signRefreshToken } = require("../../../utils/jwt");

const loginRepo = async (data) => {
  const isMysql = true;
  let adminData = {};

  if (isMysql) {
    [adminData] = await client.execute(
      "SELECT * FROM `admins` WHERE `admin_email` = ?",
      [data?.admin_email]
    );
  } else {
    [adminData] = await client.query(
      "SELECT * FROM admins WHERE admin_email = $1",
      [data?.admin_email]
    );
  }
  // console.log(adminData);
  if (!adminData || adminData.length === 0) {
    return "Account Does not exist";
  }

  const bcrypt = require("bcrypt");
  const match = await bcrypt.compare(
    data?.admin_password,
    adminData[0]?.admin_password
  );
  if (!match) {
    return "Account Does not exist";
  }

  delete adminData[0]?.admin_password;
  try {
    const payload = {
      sub: adminData[0]?.admin_id,
      admin_id: adminData[0]?.admin_id,
      email: adminData[0]?.admin_email,
      role_id: adminData[0]?.role_id,
      admin_name: adminData[0]?.admin_name,
      roles: adminData[0]?.role_id
    };
    adminData[0].token = signAccessToken(payload, "admin");
    adminData[0].refresh_token = signRefreshToken(payload, "admin");
  } catch (err) {
    console.log(err);
  }
  return adminData[0];
};

module.exports = loginRepo;
