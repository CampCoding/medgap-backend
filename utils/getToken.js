const getTokenFromHeader = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return res.status(401).json({ message: "Unauthorized: No token provided" });
};

module.exports = getTokenFromHeader;