const Product = require("../models/product.model");
const Category = require("../models/category.model");
const { resolveVisiblePrice } = require("../service/tier.service");
const CustomError = require("../utils/errors/customErrors");
// const slugify = require("slugify");


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

      pricing,

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
    console.log("object body", req.body);
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



    // Validating Stock amount
    if (Number(stock_pcs) < Number(carton_size_pcs)) {
      throw new CustomError(
        400,
        "Stock cannot be less than one full carton."
      );
    }

    if (images.length === 0) {
      throw new CustomError(
        400,
        "At least one product image is required."
      );
    }

    const existing = await Product.exists({
      sku
    });

    if (existing) {
      throw new CustomError(
        409,
        "SKU already exists."
      );
    }

    // Validate category
    if (!category) {
      throw new CustomError(
        400,
        "Category is required."
      );
    }

    const existingCategory = await Category.findById(category);

    if (!existingCategory) {
      throw new CustomError(
        404,
        "Category not found."
      );
    }

    const existingBarcode = await Product.exists({
      barcode
    });

    if (existingBarcode) {
      throw new CustomError(
        409,
        "Barcode already exists."
      );
    }
    const tiers = [
      "retailer",
      "wholesaler",
      "distributor_local",
      "distributor_international"
    ];

    for (const tier of tiers) {
      if (!pricing?.[tier]) {
        throw new CustomError(
          400,
          `${tier} pricing is required.`
        );
      }
    }

    if (pricing) {

      Object.values(pricing).forEach(tier => {

        tier.unit_price = Number(tier.unit_price);

        tier.moq = Number(tier.moq);

      });

    }

    const product = await Product.create({
      name,
      // slug: slugify(name, { lower: true, strict: true }),

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

      pricing,
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

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const isAdmin = req.user?.role === "admin";

    const {
      keyword,
      category,
      brand,
      size,
      color,
      seller,
      minStock,
      maxStock,
      minPrice,
      maxPrice,
      sort = "newest"
    } = req.query;

    const filter = {};

    /**
     * Keyword Search
     */
    if (keyword) {

      const regex = new RegExp(keyword, "i");

      filter.$or = [
        { name: regex },
        { sku: regex },
        { barcode: regex },
        { brand: regex },
        { model: regex },
        { tags: regex }
      ];

    }

    /**
     * Category
     */
    if (category) {
      filter.category = category;
    }

    /**
     * Seller
     */
    if (isAdmin && seller) {
      filter.seller = seller;
    }

    /**
     * Brand
     */
    if (brand) {
      filter.brand = brand;
    }

    /**
     * Colors
     */
    if (color) {
      filter.colors = color;
    }

    /**
     * Sizes
     */
    if (size) {
      filter.sizes = size;
    }

    /**
     * Stock filtering
     */

    if (isAdmin && (minStock || maxStock)) {

      filter.stock_pcs = {};

      if (minStock) {
        filter.stock_pcs.$gte = Number(minStock);
      }

      if (maxStock) {
        filter.stock_pcs.$lte = Number(maxStock);
      }

    }

    /**
     * Retail price filtering
     * (Public endpoint)
     */

    const visibleTier = req.user?.assignedTier || "retailer";

    if (minPrice || maxPrice) {
      filter[`pricing.${visibleTier}.unit_price`] = {};

      if (minPrice) {
        filter[`pricing.${visibleTier}.unit_price`].$gte = Number(minPrice);
      }

      if (maxPrice) {
        filter[`pricing.${visibleTier}.unit_price`].$lte = Number(maxPrice);
      }
    }
    /**
     * Sorting
     */


    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },

      price_low: {
        [`pricing.${visibleTier}.unit_price`]: 1
      },

      price_high: {
        [`pricing.${visibleTier}.unit_price`]: -1
      }
    };

    if (isAdmin) {

      sortMap.stock_high = {
        stock_pcs: -1
      };

      sortMap.stock_low = {
        stock_pcs: 1
      };

    }

    const total = await Product.countDocuments(filter);

    const productsFromDB = await Product.find(filter)
      .populate("category", "name")
      .populate("seller", isAdmin ? "username email" : "username")
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort(sortMap[sort] || sortMap.newest)
      .lean();

    /**
     * Format stock
     */

    const products = productsFromDB.map(product => {
      const visible = resolveVisiblePrice(product, req.user);

      const {
        stock_pcs,
        isAvailable,
        pricing,
        ...safeProduct
      } = product;

      const available =
        isAvailable &&
        stock_pcs >= product.carton_size_pcs;

      const response = {
        ...safeProduct,
        price: visible.price,
        currency: visible.currency,
        tier: visible.tier,
        available
      };

      if (isAdmin) {
        response.stock_pcs = stock_pcs;
        response.isAvailable = isAvailable;
      }

      return response;
    });

    res.status(200).json({

      success: true,

      total,

      page,

      pages: Math.ceil(total / limit),

      products: products

    });

  } catch (error) {

    next(error);

  }
};

// @desc Get all products with filters, pagination, search for admin
// @route GET /api/admin/products
// @access Public
const getAllProductsForAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);

    const {
      keyword,
      category,
      brand,
      size,
      color,
      seller,
      minStock,
      maxStock,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const filter = {};

    /**
     * Keyword Search
     */
    if (keyword) {
      const regex = new RegExp(keyword, "i");

      filter.$or = [
        { name: regex },
        { sku: regex },
        { barcode: regex },
        { brand: regex },
        { model: regex },
        { tags: regex },
      ];
    }

    /**
     * Category
     */
    if (category) {
      filter.category = category;
    }

    /**
     * Seller
     */
    if (seller) {
      filter.seller = seller;
    }

    /**
     * Brand
     */
    if (brand) {
      filter.brand = brand;
    }

    /**
     * Colors
     */
    if (color) {
      filter.colors = color;
    }

    /**
     * Sizes
     */
    if (size) {
      filter.sizes = size;
    }

    /**
     * Stock Filtering
     */
    if (minStock || maxStock) {
      filter.stock_pcs = {};

      if (minStock) {
        filter.stock_pcs.$gte = Number(minStock);
      }

      if (maxStock) {
        filter.stock_pcs.$lte = Number(maxStock);
      }
    }

    /**
     * Price Filtering
     * Searches across retailer price.
     * (Can be changed to another tier if preferred)
     */
    if (minPrice || maxPrice) {
      filter["pricing.retailer.unit_price"] = {};

      if (minPrice) {
        filter["pricing.retailer.unit_price"].$gte = Number(minPrice);
      }

      if (maxPrice) {
        filter["pricing.retailer.unit_price"].$lte = Number(maxPrice);
      }
    }

    /**
     * Sorting
     */
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },

      name_asc: { name: 1 },
      name_desc: { name: -1 },

      stock_high: { stock_pcs: -1 },
      stock_low: { stock_pcs: 1 },

      retailer_price_low: {
        "pricing.retailer.unit_price": 1,
      },

      retailer_price_high: {
        "pricing.retailer.unit_price": -1,
      },

      wholesaler_price_low: {
        "pricing.wholesaler.unit_price": 1,
      },

      wholesaler_price_high: {
        "pricing.wholesaler.unit_price": -1,
      },

      distributor_local_low: {
        "pricing.distributor_local.unit_price": 1,
      },

      distributor_local_high: {
        "pricing.distributor_local.unit_price": -1,
      },

      distributor_international_low: {
        "pricing.distributor_international.unit_price": 1,
      },

      distributor_international_high: {
        "pricing.distributor_international.unit_price": -1,
      },
    };

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("seller", "username email fullname")
      .select("-__v")
      .sort(sortMap[sort] || sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formattedProducts = products.map((product) => ({
      ...product,

      available:
        product.isAvailable &&
        product.stock_pcs >= product.carton_size_pcs,
    }));

    res.status(200).json({
      success: true,

      total,

      page,

      pages: Math.ceil(total / limit),

      products: formattedProducts,
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
      .populate("seller", "username")
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
      .populate("seller", "username")
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


    if (updates.sku) {
      const existing = await Product.exists({
        sku: updates.sku,
        _id: { $ne: product._id }
      });

      if (existing) {
        throw new CustomError(
          409,
          "SKU already exists."
        );
      }
    }

    if (updates.barcode) {
      const existingBarcode = await Product.exists({
        barcode: updates.barcode,
        _id: { $ne: product._id }
      });

      if (existingBarcode) {
        throw new CustomError(
          409,
          "Barcode already exists."
        );
      }
    }

    // Convert numeric fields
    const numberFields = [
      "carton_size_pcs",
      "stock_pcs",
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

    const cartonSize =
      updates.carton_size_pcs ??
      product.carton_size_pcs;

    const stock =
      updates.stock_pcs ??
      product.stock_pcs;

    if (stock < cartonSize) {
      throw new CustomError(
        400,
        "Stock cannot be less than one carton."
      );
    }


    if (updates.pricing) {

      const tiers = [
        "retailer",
        "wholesaler",
        "distributor_local",
        "distributor_international"
      ];

      // Merge existing pricing with incoming updates
      const mergedPricing = {
        ...product.pricing.toObject(),
        ...updates.pricing
      };

      // Validate and normalize
      for (const tier of tiers) {

        if (!mergedPricing[tier]) {
          continue;
        }

        mergedPricing[tier].unit_price = Number(
          mergedPricing[tier].unit_price
        );

        mergedPricing[tier].moq = Number(
          mergedPricing[tier].moq
        );

        if (
          isNaN(mergedPricing[tier].unit_price) ||
          mergedPricing[tier].unit_price < 0
        ) {
          throw new CustomError(
            400,
            `${tier} unit price is invalid.`
          );
        }

        if (
          isNaN(mergedPricing[tier].moq) ||
          mergedPricing[tier].moq < 1
        ) {
          throw new CustomError(
            400,
            `${tier} MOQ is invalid.`
          );
        }
      }

      product.pricing = mergedPricing;

      delete updates.pricing;
    }

    Object.assign(product, updates);

    await product.save();

    await product.populate("category", "name");
    await product.populate("seller", "username");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
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
  toggleAvailability,
  getAllProductsForAdmin
};

