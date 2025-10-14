const modulesRepository = require("../../repositories/modules/modules");
const responseBuilder = require("../../utils/responsebuilder");
const { validationResult } = require("express-validator");

class ModulesController {
  // إنشاء مادة جديدة
  async createModule(req, res) {
    try {
      // التحقق من صحة البيانات
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const { subject_name, subject_code, description, status, subject_color } =
        req.body;

      // التحقق من عدم وجود مادة بنفس الكود
      const existingModule = await modulesRepository.getModuleByCode(
        subject_code
      );
      if (existingModule) {
        return responseBuilder.badRequest(
          res,
          "Module with this subject code already exists"
        );
      }

      const moduleData = {
        subject_name,
        subject_code,
        description,
        status: status || "active",
        subject_color: subject_color || "#3498db"
      };

      const createdBy = req.user ? req.user.admin_id : null;
      const newModule = await modulesRepository.createModule(
        moduleData,
        createdBy
      );

      return responseBuilder.success(
        res,
        {
          message: "Module created successfully",
          module: newModule
        },
        201
      );
    } catch (error) {
      console.error("Error creating module:", error);
      return responseBuilder.serverError(res, "Failed to create module");
    }
  }

  //  جميع المواد
  async getAllModules(req, res) {
    try {
      const { status, search, limit = 50, offset = 0 } = req.query;

      const filters = {
        status,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      // إزالة القيم الفارغة
      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      const modules = await modulesRepository.getAllModules(filters);

      return responseBuilder.success(res, {
        message: "Modules retrieved successfully",
        modules,
        count: modules.length,
        filters: filters
      });
    } catch (error) {
      console.error("Error fetching modules:", error);
      return responseBuilder.serverError(res, "Failed to fetch modules");
    }
  }

  async createUnit(req, res) {
    try {
      const { id } = req.params;
      const { unit_name, unit_description, unit_order, status } = req.body;
      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }
      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }
      if (!unit_name || unit_name.trim() === "") {
        return responseBuilder.badRequest(res, "Unit name is required");
      }
      const unitData = {
        module_id: parseInt(id),
        unit_name,
        unit_description,
        unit_order: unit_order || 0,
        status: status || "active"
      };
      const createdBy = req.user ? req.user.admin_id : null;
      const newUnit = await modulesRepository.createUnit(unitData, createdBy);
      if (!newUnit) {
        return responseBuilder.badRequest(res, "Failed to create unit");
      }
      return responseBuilder.success(
        res,
        {
          message: "Unit created successfully",
          unit: newUnit
        },
        201
      );
    } catch (error) {
      console.error("Error creating unit:", error);
      return responseBuilder.serverError(res, "Failed to create unit");
    }
  }

  async updateUnit(req, res) {
    try {
      const { id, unitId } = req.params;
      const { unit_name, unit_description, unit_order, status } = req.body;
      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }
      if (!unitId || isNaN(unitId)) {
        return responseBuilder.badRequest(res, "Invalid unit ID");
      }
      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      let updateData = {};
      if (unit_name !== undefined) updateData.unit_name = unit_name;
      if (unit_description !== undefined)
        updateData.unit_description = unit_description;
      if (unit_order !== undefined) updateData.unit_order = unit_order;
      if (status !== undefined) updateData.status = status;
      const updatedBy = req.user ? req.user.admin_id : null;
      updateData.unit_id = parseInt(unitId);
      updateData.module_id = parseInt(id);
      if (Object.keys(updateData).length === 2) {
        return responseBuilder.badRequest(res, "No fields to update");
      }
      const updatedUnit = await modulesRepository.updateUnit(
        updateData,
        updatedBy
      );
      return responseBuilder.success(res, {
        message: "Unit updated successfully",
        unit: updatedUnit
      });
    } catch (error) {
      console.error("Error updating unit:", error);
      return responseBuilder.serverError(res, "Failed to update unit");
    }
  }

  async deleteUnit(req, res) {
    try {
      const { id, unitId } = req.params;
      let unitData = {};
      unitData.unit_id = parseInt(unitId);
      unitData.module_id = parseInt(id);
      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }
      if (!unitId || isNaN(unitId)) {
        return responseBuilder.badRequest(res, "Invalid unit ID");
      }
      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      const deletedBy = req.user ? req.user.admin_id : null;

      const deletedUnit = await modulesRepository.deleteUnit(unitData, deletedBy);
      if (!deletedUnit) {
        return responseBuilder.badRequest(res, "Failed to delete unit");
      }
      return responseBuilder.success(res, {
        message: "Unit deleted successfully",
        unit: deletedUnit
      });
    } catch (error) {
      console.error("Error deleting unit:", error);
      return responseBuilder.serverError(res, "Failed to delete unit");
    }
  }
  //  مادة بواسطة ID
  async getModuleById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      const module = await modulesRepository.getModuleById(parseInt(id));

      if (!module) {
        return responseBuilder.notFound(res, "Module not found");
      }

      return responseBuilder.success(res, {
        message: "Module retrieved successfully",
        module
      });
    } catch (error) {
      console.error("Error fetching module:", error);
      return responseBuilder.serverError(res, "Failed to fetch module");
    }
  }

  // تحديث بيانات مادة
  async updateModule(req, res) {
    try {
      // التحقق من صحة البيانات
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return responseBuilder.validationError(res, errors.array());
      }

      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      const { subject_name, subject_code, description, status, subject_color } =
        req.body;

      // التحقق من الكود إذا تم تغييره
      if (subject_code && subject_code !== existingModule.subject_code) {
        const moduleWithCode = await modulesRepository.getModuleByCode(
          subject_code
        );
        if (moduleWithCode) {
          return responseBuilder.badRequest(
            res,
            "Another module with this subject code already exists"
          );
        }
      }

      const updateData = {};

      // إضافة الحقول التي تم تمريرها فقط
      if (subject_name !== undefined) updateData.subject_name = subject_name;
      if (subject_code !== undefined) updateData.subject_code = subject_code;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (subject_color !== undefined) updateData.subject_color = subject_color;

      const updatedBy = req.user ? req.user.admin_id : null;
      const updatedModule = await modulesRepository.updateModule(
        parseInt(id),
        updateData,
        updatedBy
      );

      return responseBuilder.success(res, {
        message: "Module updated successfully",
        module: updatedModule
      });
    } catch (error) {
      console.error("Error updating module:", error);
      return responseBuilder.serverError(res, "Failed to update module");
    }
  }

  // حذف مادة (soft delete)
  async deleteModule(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      const deletedBy = req.user ? req.user.admin_id : null;
      const deletedModule = await modulesRepository.deleteModule(
        parseInt(id),
        deletedBy
      );

      return responseBuilder.success(res, {
        message: "Module deleted successfully",
        module: deletedModule
      });
    } catch (error) {
      console.error("Error deleting module:", error);
      return responseBuilder.serverError(res, "Failed to delete module");
    }
  }

  // حذف مادة نهائياً
  async permanentDeleteModule(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      const deletedModule = await modulesRepository.permanentDeleteModule(
        parseInt(id)
      );

      return responseBuilder.success(res, {
        message: "Module permanently deleted successfully",
        module: deletedModule
      });
    } catch (error) {
      console.error("Error permanently deleting module:", error);
      return responseBuilder.serverError(
        res,
        "Failed to permanently delete module"
      );
    }
  }

  //  وحدات المادة
  async getModuleUnits(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return responseBuilder.badRequest(res, "Invalid module ID");
      }

      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }
      console.log("teacherId", req.user)
      const units = await modulesRepository.getModuleUnits(parseInt(id), req?.user?.teacher_id);

      return responseBuilder.success(res, {
        message: "Module units retrieved successfully",
        module: {
          module_id: existingModule.module_id,
          subject_name: existingModule.subject_name,
          subject_code: existingModule.subject_code
        },
        units,
        count: units.length
      });
    } catch (error) {
      console.error("Error fetching module units:", error);
      return responseBuilder.serverError(res, "Failed to fetch module units");
    }
  }

  //  المدرسين المرتبطين بالمادة
  async getModuleTeachers(req, res) {
    try {
      const { id } = req.params;


      // التحقق من وجود المادة
      const existingModule = await modulesRepository.getModuleById(
        parseInt(id)
      );
      if (!existingModule) {
        return responseBuilder.notFound(res, "Module not found");
      }

      const teachers = await modulesRepository.getModuleTeachers(parseInt(id));

      return responseBuilder.success(res, {
        message: "Module teachers retrieved successfully",
        module: {
          module_id: existingModule.module_id,
          subject_name: existingModule.subject_name,
          subject_code: existingModule.subject_code
        },
        teachers,
        count: teachers.length
      });
    } catch (error) {
      console.error("Error fetching module teachers:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch module teachers"
      );
    }
  }

  //  الطلاب المسجلين في المادة
  async getModuleStudents(req, res) {
    const students = await modulesRepository.getModuleStudents();

   
    return responseBuilder.success(res, {
      message: "Module students retrieved successfully",
      students,
      count: students.length
    });

  }

  //  إحصائيات المواد
  async getModulesStats(req, res) {
    try {
      const stats = await modulesRepository.getModulesStats();

      return responseBuilder.success(res, {
        message: "Modules statistics retrieved successfully",
        stats
      });
    } catch (error) {
      console.error("Error fetching modules stats:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch modules statistics"
      );
    }
  }

  //  المواد المتاحة للاختيار
  async getAvailableModules(req, res) {
    try {
      const modules = await modulesRepository.getAvailableModules();

      return responseBuilder.success(res, {
        message: "Available modules retrieved successfully",
        modules,
        count: modules.length
      });
    } catch (error) {
      console.error("Error fetching available modules:", error);
      return responseBuilder.serverError(
        res,
        "Failed to fetch available modules"
      );
    }
  }
}

module.exports = new ModulesController();
