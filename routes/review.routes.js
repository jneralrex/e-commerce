const express = require("express");
const router = express.Router();
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} = require("../controllers/review.controller");
const authenticate = require("../utils/authenticate");

router.post("/", authenticate, createReview);
router.get("/:productId", getProductReviews);
router.patch("/:reviewId", authenticate, updateReview);
router.delete("/:reviewId", authenticate, deleteReview);

module.exports = router;
