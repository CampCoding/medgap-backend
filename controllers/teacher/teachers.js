const teachersRepository = require("../../repositories/teacher/teachers");
const responseBuilder = require("../../utils/responsebuilder");
const { validationResult } = require("express-validator");

class TeachersController {
  async createTeacher(req, res) {
    try {
      console.log(
        "Received files:",
        req.files,
        req.body,
        JSON.parse(req.body?.module_ids)
      );
      // const errors = validationResult(req);
      // if (!errors.isEmpty()) {
      //   return responseBuilder.validationError(res, errors.array());
      // }

      const {
        full_name,
        email,
        phone,
        notes,
        module_ids,
        experience_years,
        role,
        image_url,
        qualification,
        password
      } = req.body;

      const image = req?.files?.find((file) => file.fieldname === "image");
        const document = req?.files?.find((file) => file.fieldname === "document"); // Add this line
    console.log("document", document); // Add this line

      console.log("image", image)
      const join_date =

        req.body.join_date || new Date().toISOString().split("T")[0];

      const existingTeacher = await teachersRepository.getTeacherByEmail(email);
      if (existingTeacher) {
        return responseBuilder.badRequest(
          res,
          "Teacher with this email already exists"
        );
      }

      let status = "pending";
      let createdBy = null;

      if (req.user && req.user.role === "admin") {
        status = "approved";
        createdBy = req.user.admin_id;
      }
      const saltRounds = 10;
      const bcrypt = require("bcrypt");

      const teacherData = {
        full_name,
        email,
        phone,
        notes,
        experience_years: parseInt(experience_years) || 0,
        join_date,
        role: role || "teacher",
        status,
        image_url: image_url || (image ? image.path.replace(/\\/g, "/") : null),
        qualification,
        password: await bcrypt.hash(password, saltRounds),
        image_path: image ? image.path.replace(/\\/g, "/") : null,
          document_url: document ? document.path.replace(/\\/g, "/") : null
      };

      console.log("teacherData", teacherData);

      const moduleIds = JSON.parse(module_ids);

      const newTeacher = await teachersRepository.createTeacher(
        teacherData,
        moduleIds,
        createdBy
      );

      return responseBuilder.success(
        res,
        {
          message: "Teacher created successfully"
          // teacher: newTeacher
        },
        201
      );
    } catch (error) {
      console.error("Error creating teacher:", error);
      return responseBuilder.serverError(res, "Failed to create teacher");
    }
  }

  async getAllTeachers(req, res) {
    try {
      const { status, role, search, limit = 50, offset = 0 } = req.query;

      const filters = {
        status,
        role,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      const teachers = await teachersRepository.getAllTeachers(filters);

      return responseBuilder.success(res, {
        message: "Teachers retrieved successfully",
        teachers,
        count: teachers.length,
        filters: filters
      });
    } catch (error) {
      console.error("Error fetching teachers:", error);
      return responseBuilder.serverError(res, "Failed to fetch teachers");
    }
  }

  async getTeacherById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const teacher = await teachersRepository.getTeacherById(parseInt(id));

      if (!teacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      return responseBuilder.success(res, {
        message: "Teacher retrieved successfully",
        teacher
      });
    } catch (error) {
      console.error("Error fetching teacher:", error);
      return responseBuilder.serverError(res, "Failed to fetch teacher");
    }
  }

  // inside TeachersController class — replace the existing updateTeacher method
async updateTeacher(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return responseBuilder.validationError(res, errors.array());
    }

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return responseBuilder.badRequest(res, "Invalid teacher ID");
    }

    const existingTeacher = await teachersRepository.getTeacherById(
      parseInt(id)
    );
    if (!existingTeacher) {
      return responseBuilder.notFound(res, "Teacher not found");
    }

    // Extract fields (we accept partial updates)
    const {
      full_name,
      email,
      phone,
      notes,
      module_ids,
      experience_years,
      join_date,
      role,
      status,
      image_url,
      qualification,
      password // optional
    } = req.body;

    if (email && email !== existingTeacher.email) {
      const teacherWithEmail = await teachersRepository.getTeacherByEmail(
        email
      );
      if (teacherWithEmail) {
        return responseBuilder.badRequest(
          res,
          "Another teacher with this email already exists"
        );
      }
    }

    // Prepare update payload
    const updateData = {};

    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (notes !== undefined) updateData.notes = notes;
    if (experience_years !== undefined)
      updateData.experience_years = parseInt(experience_years) || 0;
    if (join_date !== undefined) updateData.join_date = join_date;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (qualification !== undefined) updateData.qualification = qualification;

    // Handle uploaded image (req.files may be array from multer)
    const image = req?.files?.find((file) => file.fieldname === "image");
    if (image) {
      // normalize backslashes to forward slashes
      updateData.image_path = image.path.replace(/\\/g, "/");
      updateData.image_url = image.path.replace(/\\/g, "/");
      // optionally also set image_url if you want a public url generated here
      // updateData.image_url = generatePublicUrl(updateData.image_path);
    }

    // Handle password change (hash it)
    if (password !== undefined && password !== null && String(password).trim() !== "") {
      const bcrypt = require("bcrypt");
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    const updatedBy = req.user ? req.user.admin_id : null;

    // Persist teacher update
    const updatedTeacher = await teachersRepository.updateTeacher(
      parseInt(id),
      updateData,
      updatedBy
    );

    // Handle modules update if provided (module_ids can be JSON string or array)
    if (module_ids !== undefined) {
      let moduleIdsParsed = [];
      try {
        if (typeof module_ids === "string") {
          // attempt to parse JSON string; if fails, try to split by comma
          try {
            moduleIdsParsed = JSON.parse(module_ids);
          } catch (e) {
            moduleIdsParsed = module_ids
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean);
          }
        } else if (Array.isArray(module_ids)) {
          moduleIdsParsed = module_ids;
        } else if (module_ids == null) {
          moduleIdsParsed = [];
        } else {
          // other types -> coerce to array
          moduleIdsParsed = [module_ids];
        }
      } catch (err) {
        return responseBuilder.badRequest(res, "Invalid module_ids format");
      }

      // normalize to ints and validate modules exist if any
      const moduleIds = moduleIdsParsed
        .map((m) => parseInt(m))
        .filter((m) => !isNaN(m));

      if (moduleIds.length > 0) {
        const modulesRepository = require("../../repositories/modules/modules");
        for (const moduleId of moduleIds) {
          const moduleExists = await modulesRepository.getModuleById(moduleId);
          if (!moduleExists) {
            return responseBuilder.badRequest(
              res,
              `Module with ID ${moduleId} not found`
            );
          }
        }
      }

      await teachersRepository.updateTeacherModules(
        parseInt(id),
        moduleIds,
        updatedBy
      );
    }

    return responseBuilder.success(res, {
      message: "Teacher updated successfully",
      teacher: updatedTeacher
    });
  } catch (error) {
    console.error("Error updating teacher:", error);
    return responseBuilder.serverError(res, "Failed to update teacher");
  }
}


  async deleteTeacher(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const deletedBy = req.user ? req.user.admin_id : null;
      const deletedTeacher = await teachersRepository.deleteTeacher(
        parseInt(id),
        deletedBy
      );

      return responseBuilder.success(res, {
        message: "Teacher deleted successfully",
        teacher: deletedTeacher
      });
    } catch (error) {
      console.error("Error deleting teacher:", error);
      return responseBuilder.serverError(res, "Failed to delete teacher");
    }
  }

  async changeTeacherStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const allowedStatuses = ["pending", "approved", "rejected"];
      if (!status || !allowedStatuses.includes(status)) {
        return responseBuilder.badRequest(
          res,
          "Invalid status. Allowed values: pending, approved, rejected"
        );
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const changedBy = req.user ? req.user.admin_id : null;
      const updatedTeacher = await teachersRepository.changeTeacherStatus(
        parseInt(id),
        status,
        changedBy
      );

      return responseBuilder.success(res, {
        message: `Teacher status changed to ${status} successfully`,
        teacher: updatedTeacher
      });
    } catch (error) {
      console.error("Error changing teacher status:", error);
      return responseBuilder.serverError(
        res,
        "Failed to change teacher status"
      );
    }
  }

  async getTeachersStats(req, res) {
    try {
      const stats = await teachersRepository.getTeachersStats();

      return responseBuilder.success(res, {
        message: "Teachers statistics retrieved successfully",
        stats
      });
    } catch (error) {
      console.error("Error fetching teachers stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch teachers statistics"
      );
    }
  }

  async permanentDeleteTeacher(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const deletedTeacher = await teachersRepository.permanentDeleteTeacher(
        parseInt(id)
      );

      return responseBuilder.success(res, {
        message: "Teacher permanently deleted successfully",
        teacher: deletedTeacher
      });
    } catch (error) {
      console.error("Error permanently deleting teacher:", error);
      return responseBuilder.serverError(
        res,
        "Failed to permanently delete teacher"
      );
    }
  }

  async getTeacherModules(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const modules = await teachersRepository.getTeacherModules(parseInt(id));

      return responseBuilder.success(res, {
        message: "Teacher modules retrieved successfully",
        teacher: {
          teacher_id: existingTeacher.teacher_id,
          full_name: existingTeacher.full_name,
          email: existingTeacher.email
        },
        modules,
        count: modules.length
      });
    } catch (error) {
      console.error("Error fetching teacher modules:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch teacher modules"
      );
    }
  }

  async assignModuleToTeacher(req, res) {
    try {
      const { id } = req.params;
      const { module_id } = req.body;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      if (!module_id || isNaN(module_id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const assignedBy = req.user ? req.user.admin_id : null;
      const assignment = await teachersRepository.assignModuleToTeacher(
        parseInt(id),
        parseInt(module_id),
        assignedBy
      );

      return responseBuilder.success(res, {
        message: "Module assigned to teacher successfully",
        assignment
      });
    } catch (error) {
      console.error("Error assigning module to teacher:", error);
      return responseBuilder.serverError(
        res,
        "Failed to assign module to teacher"
      );
    }
  }

  async removeModuleFromTeacher(req, res) {
    try {
      const { id, moduleId } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      if (!moduleId || isNaN(moduleId)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const result = await teachersRepository.removeModuleFromTeacher(
        parseInt(id),
        parseInt(moduleId)
      );

      if (!result) {
        return responseBuilder.notFound(res, "Module assignment not found");
      }

      return responseBuilder.success(res, {
        message: "Module removed from teacher successfully",
        assignment: result
      });
    } catch (error) {
      console.error("Error removing module from teacher:", error);
      return responseBuilder.serverError(
        res,
        "Failed to remove module from teacher"
      );
    }
  }

  async updateTeacherModules(req, res) {
    try {
      const { id } = req.params;
      const { module_ids } = req.body;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid teacher ID");
      }

      const existingTeacher = await teachersRepository.getTeacherById(
        parseInt(id)
      );
      if (!existingTeacher) {
        return responseBuilder.notFound(res, "Teacher not found");
      }

      const moduleIds = Array.isArray(module_ids)
        ? module_ids.map((id) => parseInt(id)).filter((id) => !isNaN(id))
        : [];

      const updatedBy = req.user ? req.user.admin_id : null;
      await teachersRepository.updateTeacherModules(
        parseInt(id),
        moduleIds,
        updatedBy
      );

      const updatedModules = await teachersRepository.getTeacherModules(
        parseInt(id)
      );

      return responseBuilder.success(res, {
        message: "Teacher modules updated successfully",
        teacher: {
          teacher_id: existingTeacher.teacher_id,
          full_name: existingTeacher.full_name,
          email: existingTeacher.email
        },
        modules: updatedModules,
        count: updatedModules.length
      });
    } catch (error) {
      console.error("Error updating teacher modules:", error);
      return responseBuilder.serverError(
        res,
        "Failed to update teacher modules"
      );
    }
  }
}

module.exports = new TeachersController();
