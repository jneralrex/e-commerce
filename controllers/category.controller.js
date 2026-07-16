const { cloudinary } = require("../config/config");
const Category = require("../models/category.model");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");
const slugify = require("slugify");

const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !req.file) {
      return next(new CustomError("Name and image are required", 400));
    }

    const existing = await Category.findOne({ name: new RegExp(`^${name}$`, "i") });
    if (existing) return next(new CustomError("Category already exists", 400));

    const image = {
      url: req.file.path,
      public_id: req.file.filename
    };

    const slug = slugify(name, { lower: true, strict: true });

    const category = await Category.create({ name, slug, image });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const getAllProducts = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug });

    if (!category) return next(new CustomError("Category not found", 404));

    const { brand, minPrice, maxPrice, color, size } = req.query;

    const filter = { category: category._id };

    if (brand) filter.brand = new RegExp(brand, "i");
    if (color) filter.colors = { $in: [color] };
    if (size) filter.sizes = { $in: [size] };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(filter).populate("category").sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) return next(new CustomError("Category not found", 404));

    if (name) {
      category.name = name;
      category.slug = slugify(name, { lower: true, strict: true });
    }

    if (req.file) {
      await cloudinary.uploader.destroy(category.image.public_id);
      category.image = {
        url: req.file.path,
        public_id: req.file.filename
      };
    }

    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) return next(new CustomError("Category not found", 404));

    const linkedProducts = await Product.findOne({ category: id });
    if (linkedProducts) {
      return next(new CustomError("Cannot delete category: Products are linked to it", 400));
    }

    await cloudinary.uploader.destroy(category.image.public_id);
    await category.deleteOne();

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  getAllProducts
};
