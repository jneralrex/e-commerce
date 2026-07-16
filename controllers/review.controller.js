const Product = require("../models/product.model");
const Review = require("../models/review.model");
const CustomError = require("../utils/errors/customErrors");

const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(new CustomError(404, "Product not found", "ProductNotFoundError"));
    }

    const alreadyReviewed = await Review.findOne({
      product: productId,
      user: req.user._id,
    });

    if (alreadyReviewed) {
      return next(new CustomError(400, "You have already reviewed this product", "DuplicateReviewError"));
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      comment,
    });

    product.reviews.push(review._id);
    await product.save();

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

// const getReviewsByProductId = async (req, res, next) => {
//   try {
//     const { productId } = req.params;

//     // Check if product exists
//     const product = await Product.findById(productId);
//     if (!product) {
//       throw new CustomError(404, "Product not found", "NotFoundError");
//     }
//     // Fetch reviews for the product
//     const reviews = await Review.find({ product: productId })
//       .populate("user", "name email") // Populate user details      
//         .sort({ createdAt: -1 }); // Sort by most recent
//     res.status(200).json({ success: true, data: reviews });
//   } catch (error) {
//     next(error);
//   }
// };


// GET /api/reviews/:productId
const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate("user", "username")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    next(error);
  }
};



// PUT /api/reviews/:reviewId
const updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return next(new CustomError(404, "Review not found", "ReviewNotFoundError"));
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return next(new CustomError(403, "You are not authorized to update this review", "AuthorizationError"));
    }

    review.rating = rating ?? review.rating;
    review.comment = comment ?? review.comment;
    await review.save();

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reviews/:reviewId
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return next(new CustomError(404, "Review not found", "ReviewNotFoundError"));
    }

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return next(new CustomError(403, "You are not authorized to delete this review", "AuthorizationError"));
    }

    await Product.findByIdAndUpdate(review.product, {
      $pull: { reviews: review._id }
    });

    await review.remove();

    res.status(200).json({ success: true, message: "Review deleted" });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview
};
