const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");

const {
  recalculateCart,
} = require("../service/tier.service");


const resolveQuantity = ({ pcs, cartons }, product) => {

  if (pcs != null && cartons != null) {

    throw new CustomError(
      400,
      "Provide either pcs or cartons, not both."
    );

  }

  if (pcs != null) {

    const quantity = Number(pcs);

    if (
      isNaN(quantity) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new CustomError(
        400,
        "Pieces must be a whole number greater than zero."
      );
    }

    return quantity;
  }

  if (cartons != null) {

    const quantity = Number(cartons);

    if (
      isNaN(quantity) ||
      quantity <= 0
    ) {
      throw new CustomError(
        400,
        "Cartons must be greater than zero."
      );
    }

    return Math.round(
      quantity *
      product.carton_size_pcs
    );
  }

  throw new CustomError(
    400,
    "Provide either pcs or cartons."
  );

};

// Add item to cart
const addToCart = async (req, res, next) => {
  try {

    const { productId } = req.body;

    if (!productId) {
      throw new CustomError(
        400,
        "Product is required."
      );
    }

    const product = await Product.findById(productId);

    if (!product || !product.isAvailable) {
      throw new CustomError(404, "Product not available.");
    }


    const quantityPcs = resolveQuantity(
      req.body,
      product
    );

    if (quantityPcs > product.stock_pcs) {
    throw new CustomError(
        400,
        `Only ${product.stock_pcs} pcs available.`
    );
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

      pcs: quantityPcs

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
      user: req.user._id
    });

    if (!cart || cart.items.length === 0) {

      return res.status(200).json({
        success: true,
        cart: {
          items: [],
          total_cartons: 0,
          total_pcs: 0,
          subtotal: 0,
          currency: "NGN"
        }
      });

    }

    const { cart: updatedCart } =
      await recalculateCart(cart, req.user);

    await updatedCart.populate("items.product");

    await updatedCart.save();

    const responseCart = updatedCart.toObject();

    responseCart.items = responseCart.items.map(item => {

      const cartonSize =
        item.product.carton_size_pcs;

      const cartons =
        Math.floor(item.pcs / cartonSize);

      const loosePcs =
        item.pcs % cartonSize;

      return {

        ...item,

        cartons,

        loose_pcs: loosePcs,

        display_quantity:
          loosePcs === 0
            ? `${cartons} cartons`
            : `${cartons} cartons and ${loosePcs} pcs`

      };

    });

    return res.status(200).json({

      success: true,

      cart: responseCart

    });



  }

  catch (error) {

    next(error);

  }

};

// Update quantity of a specific item
const updateCartItemQuantity = async (req, res, next) => {

  try {

    const { productId } = req.body;

    if (!productId) {
      throw new CustomError(
        400,
        "Product is required."
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

    const product = await Product.findById(productId);

    if (!product || !product.isAvailable) {
      throw new CustomError(
        404,
        "Product not available."
      );
    }

    const quantityPcs = resolveQuantity(
      req.body,
      product
    );

    if (quantityPcs > product.stock_pcs) {
    throw new CustomError(
        400,
        `Only ${product.stock_pcs} pcs available.`
    );
}

    item.pcs = quantityPcs;

    await recalculateCart(cart, req.user);

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

    await recalculateCart(cart, req.user);

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
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};
