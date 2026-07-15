const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  getAllProducts
} = require("../controllers/category.controller");
const authenticate = require("../utils/authenticate");
const authorize = require("../utils/authorize");
const { uploadCategoryImages } = require("../utils/files/imagesUpload");

// Create category (admin only)
router.post(
  "/",
  authenticate,
  // authorize("admin"),
  uploadCategoryImages.single("image"),
  createCategory
);

// Get all categories
router.get("/", getCategories);

// Get all products in a category by slug
router.get("/:slug/products", getAllProducts);

// Update category (by ID)
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  uploadCategoryImages.single("image"),
  updateCategory
);

// Delete category (by ID)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  deleteCategory
);

module.exports = router;
