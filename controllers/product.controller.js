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

      carton_size_pcs,
      carton_weight_kg,
      carton_length_cm,
      carton_width_cm,
      carton_height_cm,

      price_retailer_ngn,
      price_wholesaler_ngn,
      price_distributor_ngn,
      price_international_usd,

      discount,

      category,

      stock_pcs,

      tags,
      sku,
      barcode,
      warranty,
      returnPolicy,
      shippingLocations,
      shippingCost,

      allowSelfService,
    } = req.body;

    const images =
      req.files?.images?.map(file => ({
        url: file.path,
        public_id: file.filename,
      })) || [];

    const otherImages =
      req.files?.otherImages?.map(file => ({
        url: file.path,
        public_id: file.filename,
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

      carton_size_pcs: Number(carton_size_pcs),
      carton_weight_kg: Number(carton_weight_kg),
      carton_length_cm: Number(carton_length_cm),
      carton_width_cm: Number(carton_width_cm),
      carton_height_cm: Number(carton_height_cm),

      price_retailer_ngn: Number(price_retailer_ngn),
      price_wholesaler_ngn: Number(price_wholesaler_ngn),
      price_distributor_ngn: Number(price_distributor_ngn),
      price_international_usd: Number(price_international_usd),

      discount: Number(discount || 0),

      category,

      stock_pcs: Number(stock_pcs),

      tags,
      sku,
      barcode,
      warranty,
      returnPolicy,
      shippingLocations,

      shippingCost: Number(shippingCost || 0),

      allowSelfService:
        allowSelfService === true ||
        allowSelfService === "true",

      images,
      otherImages,

      seller: req.user._id,
    });


    // Validating Stock amount
    if (Number(stock_pcs) < Number(carton_size_pcs)) {
      throw new CustomError(
        400,
        "Stock cannot be less than one full carton."
      );
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
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

    // Authorization
    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      throw new CustomError(
        403,
        "Forbidden: You can't update this product",
        "AuthError"
      );
    }

    const updates = { ...req.body };

    // Update slug
    if (updates.name) {
      updates.slug = slugify(updates.name, {
        lower: true,
        strict: true,
      });
    }

    // Convert numeric fields
    const numberFields = [
      "carton_size_pcs",
      "stock_pcs",
      "price_retailer_ngn",
      "price_wholesaler_ngn",
      "price_distributor_ngn",
      "price_international_usd",
      "discount",
      "shippingCost",
      "carton_weight_kg",
      "carton_length_cm",
      "carton_width_cm",
      "carton_height_cm",
    ];

    numberFields.forEach(field => {
      if (updates[field] !== undefined) {
        updates[field] = Number(updates[field]);
      }
    });

    // Convert boolean fields
    if (updates.allowSelfService !== undefined) {
      updates.allowSelfService =
        updates.allowSelfService === true ||
        updates.allowSelfService === "true";
    }

    // Main images
    if (req.files?.images) {
      updates.images = req.files.images.map(file => ({
        url: file.path,
        public_id: file.filename,
      }));
    }

    // Other images
    if (req.files?.otherImages) {
      updates.otherImages = req.files.otherImages.map(file => ({
        url: file.path,
        public_id: file.filename,
      }));
    }

    if (
      updates.stock_pcs !== undefined &&
      updates.stock_pcs < updates.carton_size_pcs
    ) {
      throw new CustomError(
        400,
        "Stock cannot be less than one carton."
      );
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("category", "name")
      .populate("seller", "username email");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });

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

