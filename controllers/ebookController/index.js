const path = require("path");
const {
  createRepo,
  updateRepo,
  deleteRepo,
  restoreRepo,
  setVisibilityRepo,
  toggleVisibilityRepo,
  getByIdRepo,
  listRepo
} = require("../../repositories/ebooks/ebooksRepo");
const responseBuilder = require("../../utils/responsebuilder");

/* ====================== Helpers ====================== */
const bytesToMB = (b) => (b ? +(b / (1024 * 1024)).toFixed(2) : 0);

function normalizeUploadPath(file) {
  if (!file?.path) return null;

  const parts = String(file.path).split("uploads");
  if (parts.length < 2) return null;
  return "/uploads" + parts[1].split(path.sep).join("/");
}

function pickFile(files = [], field) {
  return files?.find((f) => f?.fieldname === field) || null;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ====================== Create ====================== */
const createController = async (req, res) => {
  try {
    const fileObj = pickFile(req.files, "file");
    const thumbnailObj = pickFile(req.files, "thumbnail");

    const file = normalizeUploadPath(fileObj);
    const thumbnail = normalizeUploadPath(thumbnailObj);

    const subject_id = numOrNull(req.body?.subject_id);
    const pages = numOrNull(req.body?.pages);
    const payload = {
      subject_id,
      book_title: req.body?.book_title || req.body?.title,
      book_description:
        req.body?.book_description || req.body?.description || null,
      author: req.body?.author || null,
      file,
      pages,
      thumbnail,
      status: req.body?.status || "active",
      created_by: req.user?.id || 1,
      size: bytesToMB(fileObj?.size),
      index: req.body?.index
    };

    const missing = [];
    if (!payload.subject_id) missing.push("subject_id");
    if (!payload.book_title?.trim?.()) missing.push("book_title");
    if (!payload.file) missing.push("file");
    if (!payload.pages) missing.push("pages");
    if (missing.length) {
      return responseBuilder?.badRequest(res, {
        message: "Missing required fields",
        missing
      });
    }

    const insertId = await createRepo(payload);
    if (!insertId) {
      return responseBuilder?.badRequest(res, { message: "Create failed" });
    }
    return responseBuilder?.success(res, {
      message: "Created",
      id: insertId
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== Update (partial) ====================== */
const updateController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const fileObj = pickFile(req.files, "file");
    const thumbnailObj = pickFile(req.files, "thumbnail");
    const data = { ...req.body };

    if (fileObj) data.file = normalizeUploadPath(fileObj);
    if (thumbnailObj) data.thumbnail = normalizeUploadPath(thumbnailObj);
    if (data.pages !== undefined) data.pages = numOrNull(data.pages);
    if (data.subject_id !== undefined)
      data.subject_id = numOrNull(data.subject_id);

    const result = await updateRepo(id, data);
    return responseBuilder?.success(res, {
      message: "Updated",
      affectedRows: result?.affectedRows || 0,
      changedRows: result?.changedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== Delete ====================== */
const deleteController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const hard = String(req.query?.hard || "").toLowerCase() === "true";
    const result = await deleteRepo(id, { hard });
    return responseBuilder?.success(res, {
      message: hard ? "deleted" : "deleted",
      affectedRows: result?.affectedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== Restore ====================== */
const restoreController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const result = await restoreRepo(id);
    return responseBuilder?.success(res, {
      message: "Restored",
      affectedRows: result?.affectedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== Show / Hide / Toggle ====================== */
const showController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const result = await setVisibilityRepo(id, true);
    return responseBuilder?.success(res, {
      message: "Shown (active)",
      affectedRows: result?.affectedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

const hideController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const result = await setVisibilityRepo(id, false);
    return responseBuilder?.success(res, {
      message: "Hidden (inactive)",
      affectedRows: result?.affectedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

const toggleVisibilityController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const result = await toggleVisibilityRepo(id);
    return responseBuilder?.success(res, {
      message: "Toggled",
      affectedRows: result?.affectedRows || 0
    });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== Get By ID ====================== */
const getByIdController = async (req, res) => {
  try {
    const id = numOrNull(req.params?.id);
    if (!id)
      return responseBuilder?.badRequest(res, { message: "id is required" });

    const includeDeleted =
      String(req.query?.includeDeleted || "").toLowerCase() === "true";
    const row = await getByIdRepo(id, { includeDeleted });
    if (!row) {
      return responseBuilder?.badRequest(res, { message: "Not found" });
    }
    return responseBuilder?.success(res, { data: row });
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

/* ====================== List ====================== */
const listController = async (req, res) => {
  try {
    const page = numOrNull(req.query?.page) || 1;
    const pageSize = numOrNull(req.query?.pageSize) || 20;
    const subject_id = numOrNull(req.query?.subject_id);
    const module_id = numOrNull(req.query?.module_id);
    const book_id = numOrNull(req.query?.book_id);
    const status = req.query?.status;
    const search = req.query?.search?.trim?.() || "";
    const includeDeleted =
      String(req.query?.includeDeleted || "").toLowerCase() === "true";
    const orderBy = req.query?.orderBy || "created_at";
    const orderDir = (req.query?.orderDir || "DESC").toUpperCase();

    const result = await listRepo({
      page,
      pageSize,
      subject_id,
      status,
      search,
      includeDeleted,
      orderBy,
      orderDir,
      book_id,
      module_id
    });

    return responseBuilder?.success(res, result);
  } catch (err) {
    return responseBuilder?.badRequest(res, { message: err.message });
  }
};

module.exports = {
  createController,
  updateController,
  deleteController,
  restoreController,
  showController,
  hideController,
  toggleVisibilityController,
  getByIdController,
  listController
};
