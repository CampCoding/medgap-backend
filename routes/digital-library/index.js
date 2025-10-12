const express = require("express");
const router = express.Router();
const digitalLibraryController = require("../../controllers/digital-library/digital-library");
const {
  createDigitalLibraryFileValidation,
  updateDigitalLibraryFileValidation,
  updateFileStatusValidation,
} = require("../../middlewares/validation/digital-library");
const jwtMiddleware = require("../../middlewares/jwt"); // Assuming JWT middleware is used for auth

// Get digital library statistics
router.get("/stats", digitalLibraryController.getDigitalLibraryStats);

// Get available books (processed and approved)
router.get("/available", digitalLibraryController.getAvailableBooks);

// Get popular books (most viewed)
router.get("/popular/most-viewed", digitalLibraryController.getMostViewedBooks);

// Get recent books (latest uploads)
router.get("/recent/latest", digitalLibraryController.getRecentBooks);

// Get all digital library files with filters
router.get("/", digitalLibraryController.getAllDigitalLibraryFiles);

// Get digital library file by ID
router.get("/:id", digitalLibraryController.getDigitalLibraryFileById);

// View a book (increment view count)
router.get("/:id/view", digitalLibraryController.viewBook);

// Download a book (increment download count)
router.get("/:id/download", digitalLibraryController.downloadBook);

// Serve actual file content
router.get("/file/:filename", digitalLibraryController.serveFile);

// Create a new digital library file (Admin/Teacher only)
router.post(
  "/",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  createDigitalLibraryFileValidation,
  digitalLibraryController.createDigitalLibraryFile
);

// Update a digital library file (Admin/Teacher only)
router.put(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  updateDigitalLibraryFileValidation,
  digitalLibraryController.updateDigitalLibraryFile
);

// Update file processing status (Internal/Admin)
router.patch(
  "/:id/processing-status",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  updateFileStatusValidation,
  digitalLibraryController.updateFileProcessingStatus
);

// Update file approval status (Admin only)
router.patch(
  "/:id/approval-status",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  updateFileStatusValidation,
  digitalLibraryController.updateFileApprovalStatus
);

// Delete a digital library file (soft delete - Admin/Teacher only)
router.delete(
  "/:id",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdminOrTeacher,
  digitalLibraryController.deleteDigitalLibraryFile
);

// Permanently delete a digital library file (Admin only)
router.delete(
  "/:id/permanent",
  // jwtMiddleware.verifyToken,
  // jwtMiddleware.requireAdmin,
  digitalLibraryController.permanentDeleteDigitalLibraryFile
);

module.exports = router;
