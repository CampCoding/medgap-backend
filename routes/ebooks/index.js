const express = require("express");
const router = express.Router();

const {
  createController,
  updateController,
  deleteController,
  listController
} = require("../../controllers/ebookController");

const { uploadEbook } = require("../../utils/multer-upload-ebook");

router.post(
  "/create",

  uploadEbook.any(),
  createController
);

router.put(
  "/update/:id",

  uploadEbook.any(),
  updateController
);

router.get(
  "/list",

  listController
);

router.delete(
  "/delete/:id",

  deleteController
);

module.exports = router;
