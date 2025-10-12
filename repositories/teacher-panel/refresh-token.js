const refreshToken = async (user) => {
  const id = user?.user?.teacher_id;
  if (!id) {
    throw new Error("Unauthorized access");
  }
  const { client } = require("../../config/db-connect");
  const [existingUser] = await client.execute(
    "SELECT * FROM teachers WHERE teacher_id = ?",
    [id]
  );
  if (!existingUser || existingUser.length === 0) {
    return null;
  }
  const { signAccessToken, signRefreshToken } = require("../../utils/jwt");
  const payload = {
    teacher_id: existingUser[0].teacher_id,
    email: existingUser[0].email,
    name: existingUser[0].name,
    user: existingUser[0],
    role: "teacher"
  };
  const accessToken = signAccessToken(payload, "teacher");
  const refreshToken = signRefreshToken(payload, "teacher");
  return {
    accessToken,
    refreshToken
  };
};

module.exports = { refreshToken };