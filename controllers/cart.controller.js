const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");

const {
  recalculateCart,
  calculateCartLine,
} = require("../service/tier.service");

//Quantity response formatter
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

//Cart response formatter
const formatCartResponse = (hydratedCart, user) => {
  const responseCart = hydratedCart.toObject();

  responseCart.items = responseCart.items.map(item => {

    const calculated = calculatedItems.find(
      i =>
        i.productId.toString() ===
        item.product._id.toString()
    );

    return {
      ...item,

      cartons: calculated.cartons,
      loose_pcs: calculated.loose_pcs,

      display_quantity:
        calculated.loose_pcs === 0
          ? `${calculated.cartons} cartons`
          : `${calculated.cartons} cartons and ${calculated.loose_pcs} pcs`,

      unit_price: calculated.unit_price,
      line_total: calculated.line_total,

      currency: calculated.currency,

      tier_used: calculated.tier_used,
      base_tier: calculated.base_tier,

      required_moq: calculated.required_moq,

      next_tier: calculated.next_tier,
      next_tier_remaining: calculated.next_tier_remaining,

      message: calculated.message
    };

  });

  return responseCart;
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
    const cart = await Cart.findOne({ user: req.user._id });

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

    const {
      cart: updatedCart,
      items
    } = await recalculateCart(cart, req.user);

    await updatedCart.save();
    await updatedCart.populate("items.product");

    return res.status(200).json({
      success: true,
      cart: formatCartResponse(updatedCart, req.user)    });
  } catch (error) {
    next(error);
  }
};


// Update quantity of a specific item
const updateCartItemQuantity = async (req, res, next) => {
  try {
    const { productId, pcs } = req.body;

    if (!productId) {
      throw new CustomError(400, "Product is required.");
    }

    const product = await Product.findById(productId);
    if (!product || !product.isAvailable) {
      throw new CustomError(404, "Product not available.");
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: []
      });
    }

    let item = cart.items.find(
      (item) => item.product.toString() === productId
    );

    const quantityPcs = resolveQuantity ? resolveQuantity(req.body, product) : Number(pcs || 0);

    if (quantityPcs > product.stock_pcs) {
      throw new CustomError(400, `Only ${product.stock_pcs} pcs available.`);
    }

    if (!item) {
      if (quantityPcs > 0) {
        cart.items.push({
          product: productId,
          pcs: quantityPcs
        });
      }
    } else {
      if (quantityPcs <= 0) {
        cart.items = cart.items.filter((i) => i.product.toString() !== productId);
      } else {
        item.pcs = quantityPcs;
      }
    }

    const {
      cart: updatedCart,
      items
    } = await recalculateCart(cart, req.user);

    await updatedCart.save();
    await updatedCart.populate("items.product");

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully.",
      cart: formatCartResponse(updatedCart, items)
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

    await cart.populate("items.product");

    return res.status(200).json({
      success: true,
      message: "Item removed successfully.",
      cart: formatCartResponse(cart)
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

    return res.status(200).json({
      success: true,
      message: "Cart cleared.",
      cart: {
        items: [],
        total_cartons: 0,
        total_pcs: 0,
        subtotal: 0,
        currency: "NGN"
      }
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
