const express = require("express");
const router = express.Router();
const path = require("path");

const teachersController = require("../../controllers/teacher/teachers");
const {
  createTeacherValidation,
  updateTeacherValidation,
  changeStatusValidation,
  assignModuleValidation,
  updateModulesValidation
} = require("../../middlewares/validation/teachers");
const jwtMiddleware = require("../../middlewares/jwt");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/teachers"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || "";
    const name = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get("/", teachersController.getAllTeachers);

router.get("/stats", teachersController.getTeachersStats);

router.get("/:id", teachersController.getTeacherById);

router.post("/", upload.any(), teachersController.createTeacher);

router.put("/:id", upload.any(), teachersController.updateTeacher);

router.patch(
  "/:id/status",
  changeStatusValidation,
  teachersController.changeTeacherStatus
);

router.delete("/:id", teachersController.deleteTeacher);

router.delete("/:id/permanent", teachersController.permanentDeleteTeacher);

router.get("/:id/modules", teachersController.getTeacherModules);

router.post(
  "/:id/modules",
  assignModuleValidation,
  teachersController.assignModuleToTeacher
);

router.put(
  "/:id/modules",
  updateModulesValidation,
  teachersController.updateTeacherModules
);

router.delete(
  "/:id/modules/:moduleId",
  teachersController.removeModuleFromTeacher
);

module.exports = router;
