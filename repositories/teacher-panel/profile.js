const profile = async (req) => {
  const id = req.user?.teacher_id;
  if (!id) {
    throw new Error("Unauthorized access");
  }
  const { client } = require("../../config/db-connect");
  const [user] = await client.execute("SELECT * FROM teachers WHERE teacher_id = ?", [
    id
  ]);
  if (!user || user.length === 0) {
    return null;
  }
  delete user[0].password;
  user[0].image_url = `https://camp-coding.site/medgap/${user[0].image_url}`;
  return user[0];
};

module.exports = { profile };
