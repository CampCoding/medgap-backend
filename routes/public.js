const express = require("express");
const router = express.Router();
const adminRoutes = require("../config/routes-data")?.adminRoutes;

router.get("/docs", (req, res) => {
  if (adminRoutes && adminRoutes.length > 0) {
    res.json({
      message:
        "Welcome to the Public API. Please refer to the documentation for available endpoints.",
      adminRoutes: adminRoutes.map((admin) => admin.admins?.[0].name && ({
        name: admin.admins?.[0].name,
        baseRoute: `api/admins/${admin.admins?.[0].base_route}/`,
        description: admin.admins?.[0].description,
        routes: admin.admins?.[0].routes.map((route) => ({
          name: `/${route.name}`,
          method: route.method,
          payload: route.payload.map((param) => ({
            title: param.title,
            type: param.type,
            required: param.required,
            description: param.description,
            notes: param.notes || "N/A"
          }))
        }))
      }))?.filter(Boolean)
    });
  } else {
    res.status(404).json({ message: "No admin routes available." });
  }
});

module.exports = router;