const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");
const slugify = require("slugify");


// @desc Create new product
// @route POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      colors,
      sizes,
      brand,
      model,
      material,
      weight,
      price,
      discount,
      category,
      stock,
      tags,
      sku,
      barcode,
      warranty,
      returnPolicy,
      shippingLocations,
      shippingCost,
    } = req.body;

    const images = req.files?.images?.map(file => ({
      url: file.path,
      public_id: file.filename
    })) || [];

    const otherImages = req.files?.otherImages?.map(file => ({
      url: file.path,
      public_id: file.filename
    })) || [];


    const product = await Product.create({
      name,
      slug: slugify(name, { lower: true, strict: true }),
      description,
      colors,
      sizes,
      brand,
      model,
      material,
      weight,
      price,
      discount,
      category,
      stock,
      tags,
      seller: req.user._id,
      sku,
      barcode,
      warranty,
      returnPolicy,
      shippingLocations,
      shippingCost,
      images,
      otherImages,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// @desc Get all products with filters, pagination, search
// @route GET /api/products
// @access Public
const getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const {
      keyword,
      category,
      minPrice,
      maxPrice,
      brand,
      size,
      color
    } = req.query;

    const filter = {};

    // Keyword search
    if (keyword) {
      filter.name = { $regex: keyword, $options: "i" };
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Price filtering
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Brand / Color / Size filtering
    if (brand) filter.brand = brand;
    if (color) filter.colors = color;
    if (size) filter.sizes = size;

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("seller", "username email")
      .populate({
        path: "reviews",
        options: {
          limit: 20,
          sort: { createdAt: -1 }
        },
        select: "rating comment", 
        populate: {
          path: "user",
          select: "username profilePhoto"
        }
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      products
    });
  } catch (error) {
    next(error);
  }
};


// @desc Get product by ID
// @route GET /api/products/:id
// @access Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("seller", "username email")
      .populate({
        path: "reviews",
        populate: { path: "user", select: "username profilePhoto" }
      });

    if (!product) {
      throw new CustomError(404, "Product not found", "NotFoundError");
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};


// @desc Get product by slug
// @route GET /api/products/slug/:slug
const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug })
      .populate("category", "name")
      .populate("seller", "username email")
      .populate({
        path: "reviews",
        populate: { path: "user", select: "username profilePhoto" }
      });

    if (!product) {
      throw new CustomError(404, "Product not found", "NotFoundError");
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};


// @desc Update product
// @route PUT /api/products/:id
// @access Private (seller/admin)
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new CustomError(404, "Product not found", "NotFoundError");
    }

    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      throw new CustomError(403, "Forbidden: You can't update this product", "AuthError");
    }

    // Grab updates from request body
    const updates = { ...req.body };

    // If name is changing, update slug too
    if (updates.name) {
      updates.slug = slugify(updates.name, { lower: true, strict: true });
    }

    // If new images uploaded
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, product: updated });
  } catch (error) {
    next(error);
  }
};


// @desc Delete product
// @route DELETE /api/products/:id
// @access Private (seller/admin)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new CustomError(404, "Product not found", "NotFoundError");
    }

    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      throw new CustomError(403, "Forbidden: You can't delete this product", "AuthError");
    }

    for (const image of product.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }


    // Optional: Delete other images if they exist
    if (product.otherImages && product.otherImages.length > 0) {
      for (const otherImage of product.otherImages) {
        await cloudinary.uploader.destroy(otherImage.public_id);
      }
    };

    // Optional: Delete from cloudinary here using product.images[].public_id

    await product.deleteOne();

    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    next(error);
  }
};


const toggleAvailability = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new CustomError(404, "Product not found");

    product.isAvailable = !product.isAvailable;
    await product.save();

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductBySlug,
  toggleAvailability
};

