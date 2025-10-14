const { verifyAccessToken } = require("../utils/jwt");
const responseBuilder = require("../utils/responsebuilder");

function getTokenFromHeader(req) {
  const hdr = req.headers.authorization || "";
  const [scheme, token] = hdr.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token.trim();
  return null;
}

function requireAuth(step) {
  return (req, res, next) => {
    try {
      const token = getTokenFromHeader(req);
      if (!token)
        return responseBuilder.unauthorized(
          res,
          "Authorization token is required"
        );

      const decoded = verifyAccessToken(token, step);

      console.log("token", decoded)
      // Set user data based on user type
      if (step === "admin") {
        req.user = {
          id: decoded.admin_id,
          type: "admin",
          admin_id: decoded.admin_id,
          email: decoded.email,
          role_id: decoded.role_id,
          admin_name: decoded.admin_name,
          roles: decoded.roles || [],
        };
      }
      else if (step === "teacher") {
        req.user = {
          id: decoded?.user.teacher_id,
          type: "teacher",
          teacher_id: decoded?.user?.teacher_id,
          email: decoded?.user?.email,
          role_id: decoded?.user?.role_id,
          teacher_name: decoded?.user?.teacher_name,
          roles: decoded?.user?.roles || []
        };
      } else if (step === "student") {
        req.user = {
          id: decoded.student_id,
          type: "student",
          student_id: decoded.student_id,
          email: decoded.email,
          role_id: decoded.role_id,
          student_name: decoded.student_name,
          roles: decoded.roles || []
        };
      }

      next();
    } catch (err) {
      return responseBuilder.unauthorized(res, "Invalid or expired token");
    }
  };
}

function attachUserIfPresent(step) {
  return (req, _res, next) => {
    try {
      const token = getTokenFromHeader(req);
      if (!token) return next();
      const decoded = verifyAccessToken(token, step);

      // Set user data based on user type
      if (step === "admin") {
        req.user = {
          id: decoded.admin_id,
          type: "admin",
          admin_id: decoded.admin_id,
          email: decoded.email,
          role_id: decoded.role_id,
          admin_name: decoded.admin_name,
          roles: decoded.roles || [],
        };
      } else if (step === "teacher") {
        req.user = {
          id: decoded.teacher_id,
          type: "teacher",
          teacher_id: decoded.teacher_id,
          email: decoded.email,
          role_id: decoded.role_id,
          teacher_name: decoded.teacher_name,
          roles: decoded.roles || [],
        };
      } else if (step === "student") {
        req.user = {
          id: decoded.student_id,
          type: "student",
          student_id: decoded.student_id,
          email: decoded.email,
          role_id: decoded.role_id,
          student_name: decoded.student_name,
          roles: decoded.roles || [],
        };
      }
    } catch (_) {}
    next();
  };
}

function requireRole(...allowed) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const ok = roles.some((r) => allowed.includes(r));
    if (!ok)
      return responseBuilder.forbidden(
        res,
        "You don't have enough permissions to access this resource"
      );
    next();
  };
}

// وظائف مساعدة للمدرسين
const verifyToken = (req, res, next) => {
  return requireAuth("admin")(req, res, next);
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.type !== "admin") {
    return responseBuilder.forbidden(res, "Admin access required");
  }
  next();
};

const attachUser = (req, res, next) => {
  return attachUserIfPresent("admin")(req, res, next);
};

module.exports = {
  requireAuth,
  attachUserIfPresent,
  requireRole,
  verifyToken,
  requireAdmin,
  attachUser,
};
