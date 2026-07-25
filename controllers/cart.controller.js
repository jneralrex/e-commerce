const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");

const {
  resolveTier,
  calculateCartLine,
  calculateCartTotals,
  validateMOQ,
  getCurrency,
} = require("../service/tier.service");

// Add item to cart
const addToCart = async (req, res, next) => {
  try {

    const { productId, cartons } = req.body;

    const parsedCartons = Number(cartons);

    if (
      !productId ||
      isNaN(parsedCartons) ||
      !Number.isInteger(parsedCartons) ||
      parsedCartons < 1
    ) {
      throw new CustomError(
        400,
        "Cartons must be a whole number greater than zero."
      );
    }

    const product = await Product.findById(productId);

    if (!product || !product.isAvailable) {
      throw new CustomError(404, "Product not available.");
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [],
      });
    }

    const existing = cart.items.find(
      item => item.product.toString() === productId
    );

    if (existing) {
      throw new CustomError(
        400,
        "Product already exists in cart."
      );
    }

    cart.items.push({
      product: productId,
      cartons: parsedCartons,
    });

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item added to cart."
    });

  } catch (error) {
    next(error);
  }
};


//  Fetch user's cart
const getUserCart = async (req, res, next) => {
  try {

    const cart = await Cart.findOne({
      user: req.user._id,
    }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        cart: {
          items: [],
          totalPcs: 0,
          subtotal: 0,
        },
      });
    }

    // Calculate total pcs first

    const totalPcs = cart.items.reduce((sum, item) => {

      return sum + (
        item.cartons *
        item.product.carton_size_pcs
      );

    }, 0);

    // Resolve customer's tier

    const tier = resolveTier(req.user, totalPcs);

    // Recalculate every line

    const lines = cart.items.map(item =>
      calculateCartLine(
        item.product,
        item.cartons,
        tier
      )
    );

    const totals = calculateCartTotals(lines);

    const moq = validateMOQ(
      tier,
      totals.totalPcs
    );


    res.status(200).json({

      success: true,

      cart: {

        tier,

        currency: getCurrency(tier),

        items: lines,

        totalPcs: totals.totalPcs,

        subtotal: totals.subtotal,

        moq

      }

    });

  } catch (error) {

    next(error);

  }
};

// Update quantity of a specific item
const updateCartItemCartons = async (req, res, next) => {

  try {

    const { productId, cartons } = req.body;

    const parsedCartons = Number(cartons);

    if (
      !productId ||
      isNaN(parsedCartons) ||
      !Number.isInteger(parsedCartons) ||
      parsedCartons < 1
    ) {
      throw new CustomError(
        400,
        "Cartons must be at least 1."
      );
    }

    const cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      throw new CustomError(404, "Cart not found.");
    }

    const item = cart.items.find(
      item => item.product.toString() === productId
    );

    if (!item) {
      throw new CustomError(
        404,
        "Product not found in cart."
      );
    }

    item.cartons = parsedCartons;

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart updated successfully."
    });

  } catch (error) {

    next(error);

  }

};

//  Remove a specific item from cart
const removeFromCart = async (req, res, next) => {

  try {

    const { productId } = req.params;

    const cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      throw new CustomError(404, "Cart not found.");
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Item removed successfully."
    });

  } catch (error) {

    next(error);

  }

};

// Clear entire cart
const clearCart = async (req, res, next) => {

  try {

    await Cart.findOneAndDelete({
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Cart cleared."
    });

  } catch (error) {

    next(error);

  }

};

module.exports = {
  addToCart,
  getUserCart,
  updateCartItemCartons,
  removeFromCart,
  clearCart,
};
