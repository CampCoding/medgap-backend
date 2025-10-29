const express = require("express");
const router = express.Router();
const modulesController = require("../../controllers/modules/modules");
const {
  createModuleValidation,
  updateModuleValidation
} = require("../../middlewares/validation/modules");
const jwtMiddleware = require("../../middlewares/jwt");

router.get("/available", modulesController.getAvailableModules);

router.get(
  "/",

  modulesController.getAllModules
);

router.get(
  "/stats",

  modulesController.getModulesStats
);

router.get(
  "/:id",

  modulesController.getModuleById
);

router.get(
  "/:id/units",
  (req, res, next)=>{
      try {
    const token = getTokenFromHeader(req, res);
    console.log("token", token)
    if (!token || res.headersSent) return;
    const decoded = verifyAccessToken(token, "teacher");
    console.log("decoded", decoded)
    req.user = decoded;
    next()
  } catch (err) {
      next()
  }
  },
 (req, res)=> modulesController.getModuleUnits(req, res)
);

router.get(
  "/:id/teachers",

  modulesController.getModuleTeachers
);

router.post(
  "/:id/units/create",

  modulesController.createUnit
);

router.put("/:id/units/:unitId/update", modulesController.updateUnit);

router.delete("/:id/units/:unitId/delete", modulesController.deleteUnit);

router.get("/:id/students", async (req, res) => {

  await modulesController.getModuleStudents(req, res);
});

router.post(
  "/",

  createModuleValidation,
  modulesController.createModule
);

router.put(
  "/:id",

  updateModuleValidation,
  modulesController.updateModule
);

router.delete(
  "/:id",

  modulesController.deleteModule
);

router.delete(
  "/:id/permanent",

  modulesController.permanentDeleteModule
);

module.exports = router;
