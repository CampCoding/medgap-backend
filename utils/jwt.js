const jwt = require("jsonwebtoken");

const {
  ADMIN_JWT_ACCESS_SECRET,
  ADMIN_JWT_REFRESH_SECRET,
  TEACHER_JWT_ACCESS_SECRET,
  TEACHER_JWT_REFRESH_SECRET,
  STUDENT_JWT_ACCESS_SECRET,
  STUDENT_JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN = "90m",
  JWT_REFRESH_EXPIRES_IN = "7d"
} = process.env;

// Assumes jwt and the secret/env vars are already defined in this module.

const signAccessToken = (payload, step) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("signAccessToken: payload must be an object");
  }

  const secrets = {
    admin: ADMIN_JWT_ACCESS_SECRET,
    teacher: TEACHER_JWT_ACCESS_SECRET,
    student: STUDENT_JWT_ACCESS_SECRET,
  };

  const selected = secrets[step] || secrets.admin;
  if (!selected) {
    throw new Error(`signAccessToken: missing access secret for step "${step || 'admin'}"`);
  }

  return jwt.sign(payload, selected, { expiresIn: JWT_ACCESS_EXPIRES_IN });
};

const signRefreshToken = (payload, step, jti) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("signRefreshToken: payload must be an object");
  }

  const secrets = {
    admin: ADMIN_JWT_REFRESH_SECRET,
    teacher: TEACHER_JWT_REFRESH_SECRET,
    student: STUDENT_JWT_REFRESH_SECRET,
  };

  const selected = secrets[step] || secrets.admin;
  if (!selected) {
    throw new Error(`signRefreshToken: missing refresh secret for step "${step || 'admin'}"`);
  }

  const body = jti ? { ...payload, jti } : { ...payload };
  return jwt.sign(body, selected, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

const verifyAccessToken = (token, step) => {
  let secret;
  switch (step) {
    case "admin":
      secret = ADMIN_JWT_ACCESS_SECRET;
      break;
    case "teacher":
      secret = TEACHER_JWT_ACCESS_SECRET;
      break;
    case "student":
      secret = STUDENT_JWT_ACCESS_SECRET;
      break;
    default:
      secret = ADMIN_JWT_ACCESS_SECRET;
  }

  return jwt.verify(token, secret, { ignoreExpiration: true });
};
const verifyRefreshToken = (token, step) => {
  let secret;
  switch (step) {
    case "admin":
      secret = ADMIN_JWT_REFRESH_SECRET;
      break;
    case "teacher":
      secret = TEACHER_JWT_REFRESH_SECRET;
      break;
    case "student":
      secret = STUDENT_JWT_REFRESH_SECRET;
      break;
    default:
      secret = ADMIN_JWT_REFRESH_SECRET;
  }
  return jwt.verify(token, secret, { ignoreExpiration: true });
};
module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
