const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const CustomError = require("../utils/errorHandler");

// Add item to cart
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const parsedQty = Number(quantity);

    if (!productId || isNaN(parsedQty) || parsedQty < 1) {
      return next(new CustomError(400, "Valid productId and quantity required"));
    }

    const product = await Product.findById(productId);
    if (!product) {
      return next(new CustomError(404, "Product not found"));
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      const itemExists = cart.items.find(
        item => item.product.toString() === productId
      );

      if (itemExists) {
        return res.status(400).json({
          success: false,
          message: "Product already exists in cart",
        });
      }

      cart.items.push({ product: productId, quantity: parsedQty });
      await cart.save();
    } else {
      cart = await Cart.create({
        user: req.user._id,
        items: [{ product: productId, quantity: parsedQty }],
      });
    }

    res.status(200).json({ success: true, message: "Item added to cart", cart });
  } catch (error) {
    next(error);
  }
};


//  Fetch user's cart
const getUserCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate("user", "email").populate("items.product");

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        cart: { items: [] },
      });
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// Update quantity of a specific item
const updateCartItemQuantity = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || typeof quantity !== "number" || quantity < 1) {
      return next(new CustomError(400, "Valid productId and quantity required"));
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(new CustomError(404, "Cart not found"));

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) return next(new CustomError(404, "Product not in cart"));

    item.quantity = quantity;
    await cart.save();

    res.status(200).json({ success: true, message: "Cart updated", cart });
  } catch (error) {
    next(error);
  }
};

//  Remove a specific item from cart
const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(new CustomError(404, "Cart not found"));

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return next(new CustomError(404, "Product not found in cart"));
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.status(200).json({ success: true, message: "Item removed from cart", cart });
  } catch (error) {
    next(error);
  }
};

// Clear entire cart
const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndDelete({ user: req.user._id });
    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  getUserCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};
