const { client } = require("../../config/db-connect");
const bcrypt = require("bcrypt");

const loginRepo = async ({ data }) => {
  const { email, password } = data;

  const [user] = await client.execute(
    "SELECT * FROM teachers WHERE email = ?",
    [email]
  );

  if (!user || user.length === 0) {
    return null;
  }

  const isMatch = await bcrypt.compare(password, user[0]?.password || "");
  if (!isMatch) {
    return null;
  }

  delete user[0].password;
  user[0].image_url = `https://camp-coding.site/medgap/${user[0].image_url}`;
  const { signAccessToken, signRefreshToken } = require("../../utils/jwt");
  const access = signAccessToken({
    id: user[0].id,
    user: user[0]
  }, "teacher");

  const refresh = signRefreshToken({
    id: user[0].id,
    user: user[0]
  }, "teacher");

  user[0].access = access;
  user[0].refresh = refresh;

  return user[0];
};

module.exports = {
  loginRepo
};
