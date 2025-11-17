const responseBuilder = require("../utils/responsebuilder");
const { updateFreeFlag } = require("../repositories/common/freeAccess");

const RESOURCE_LABELS = {
  book: "Book",
  topic: "Topic",
  exam: "Exam",
};

const extractTeacherId = (user = {}) =>
  user.teacher_id ||
  user?.user?.teacher_id ||
  (user.type === "teacher" ? user.id : null);

const parseFreeInput = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  value === "true" ||
  value === "FREE";

const buildFreeHandler = (resourceType) => {
  return async (req, res) => {
    const { id } = req.params;
    const { free } = req.body || {};

    if (!id) {
      return responseBuilder.badRequest(res, "Resource id is required");
    }

    if (typeof free === "undefined") {
      return responseBuilder.badRequest(res, "free value is required");
    }

    const teacherContext =
      req.user?.type === "teacher" ? extractTeacherId(req.user) : null;

    const result = await updateFreeFlag({
      resourceType,
      resourceId: id,
      free: parseFreeInput(free),
      teacherId: teacherContext,
    });

    if (result?.forbidden) {
      return responseBuilder.forbidden(
        res,
        "Only administrators can update this resource"
      );
    }

    if (!result || !result.affectedRows) {
      return responseBuilder.notFound(
        res,
        `${RESOURCE_LABELS[resourceType] || "Resource"} not found or not accessible`
      );
    }

    return responseBuilder.success(
      res,
      {
        message: `${
          RESOURCE_LABELS[resourceType] || "Resource"
        } free status updated`,
        data: {
          id,
          free: !!parseFreeInput(result.record?.free),
          resource: result.record,
        },
      },
      200
    );
  };
};

module.exports = {
  setBookFree: buildFreeHandler("book"),
  setTopicFree: buildFreeHandler("topic"),
  setExamFree: buildFreeHandler("exam"),
};

