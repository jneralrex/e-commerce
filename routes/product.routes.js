const express = require("express");
const router = express.Router();

const {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  toggleAvailability,
  getAllProductsForAdmin,
  getProductByIdForAdmin
} = require("../controllers/product.controller");
const authenticate = require("../utils/authenticate");
const authorize = require("../utils/authorize");

const { uploadProductImages } = require("../utils/files/imagesUpload");

// Public routes
router.get("/", getAllProducts);
router.get("/admin", authenticate, authorize("admin"), getAllProductsForAdmin);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);
router.get("/admin/:id", authenticate, authorize("admin"), getProductByIdForAdmin);


// Protected routes
router.post(
  "/",
  authenticate,
  authorize("admin"),
  uploadProductImages.fields([
    { name: "images", maxCount: 5 },
    { name: "otherImages", maxCount: 5 }
  ]),
  createProduct
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  uploadProductImages.fields([
    { name: "images", maxCount: 5 },
    { name: "otherImages", maxCount: 5 }
  ]),
  updateProduct
);

router.delete("/delete/:id", authenticate, authorize("admin"), deleteProduct);
router.patch("/toggle/:id", authenticate, authorize("admin"), toggleAvailability);

module.exports = router;
