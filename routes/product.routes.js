const express = require("express");
const router = express.Router();

const {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  toggleAvailability
} = require("../controllers/product.controller");
const authenticate = require("../utils/authenticate");
const { uploadProductImages } = require("../utils/files/imagesUpload");

// Public routes
router.get("/", getAllProducts);
router.get("/slug/:slug", getProductBySlug); // new slug route
router.get("/:id", getProductById);

// Protected routes
router.post(
  "/",
  authenticate,
  uploadProductImages.fields([
    { name: "images", maxCount: 5 },
    { name: "otherImages", maxCount: 5 }
  ]),
  createProduct
);

router.patch(
  "/:id",
  authenticate,
  uploadProductImages.fields([
    { name: "images", maxCount: 5 },
    { name: "otherImages", maxCount: 5 }
  ]),
  updateProduct
);

router.delete("/delete/:id", authenticate, deleteProduct);
router.patch("/toggle/:id", authenticate, toggleAvailability);

module.exports = router;
