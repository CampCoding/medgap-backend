const express = require("express");
const router = express.Router();
const modulesController = require("../../controllers/modules/modules");
const getTokenFromHeader = require("../../utils/getToken");
const {
  createModuleValidation,
  updateModuleValidation
} = require("../../middlewares/validation/modules");
const jwtMiddleware = require("../../middlewares/jwt");
const { verifyAccessToken } = require("../../utils/jwt");

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
  
  (req, res) => modulesController.getModuleUnits(req, res)
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
