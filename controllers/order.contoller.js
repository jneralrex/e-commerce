const Cart = require("../models/cart.model");
const Order = require("../models/order.model");
const CustomError = require("../utils/errorHandler");

const createOrder = async (req, res, next) => {
    try {
        const { shippingAddress, email } = req.body;

        const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

        if (!cart || cart.items.length === 0)
            return next(new CustomError(400, "Cart is empty"));

        const totalAmount = cart.items.reduce((acc, item) => {
            return acc + item.product.discountedPrice * item.quantity;
        }, 0);

        const order = await Order.create({
            user: req.user._id,
            items: cart.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity
            })),
            totalAmount,
            shippingAddress,
        });

        await Cart.findOneAndDelete({ user: req.user._id });

        res.status(201).json({ success: true, data: order }).populate("user", "email");;
    } catch (error) {
        next(error);
    }
};

const getUserOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user._id }).populate("items.product");
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};


const getSingleOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId).populate("items.product");

        if (!order) return next(new CustomError(404, "Order not found"));

        if (order.user.toString() !== req.user._id.toString() && req.user.role !== "admin")
            return next(new CustomError(403, "Unauthorized to access this order"));

        res.status(200).json({ success: true, data: order }).populate("user", "email");
    } catch (error) {
        next(error);
    }
};


const markOrderAsPaid = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) return next(new CustomError(404, "Order not found"));

        order.paymentStatus = "Paid";
        await order.save();

        res.status(200).json({ success: true, message: "Order marked as paid" });
    } catch (error) {
        next(error);
    }
};


const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { newStatus } = req.body; // client sends newStatus to update

    if (!newStatus) {
      return next(new CustomError(400, "New status is required"));
    }

    const allowedStatuses = Order.schema.path('orderStatus').enumValues;

    if (!allowedStatuses.includes(newStatus)) {
      return next(new CustomError(400, `Invalid order status. Allowed values: ${allowedStatuses.join(", ")}`));
    }

    const order = await Order.findById(orderId);
    if (!order) return next(new CustomError(404, "Order not found"));

    // Optional: Add logic here to check valid transitions if you want
    // Example: allow only certain transitions
    // if (!isValidTransition(order.orderStatus, newStatus)) {
    //    return next(new CustomError(400, `Cannot change status from ${order.orderStatus} to ${newStatus}`));
    // }

    order.orderStatus = newStatus;
    await order.save();

    res.status(200).json({ success: true, message: `Order status updated to ${newStatus}`, order });
  } catch (error) {
    next(error);
  }
};


const getMyOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};


const cancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

        if (!order) return next(new CustomError(404, "Order not found"));
        if (order.orderStatus !== "Processing")
            return next(new CustomError(400, "Cannot cancel order once shipped"));

        order.orderStatus = "Cancelled";
        await order.save();

        res.status(200).json({ success: true, message: "Order cancelled" });
    } catch (error) {
        next(error);
    }
};


const filterOrders = async (req, res, next) => {
    try {
        const { status, start, end } = req.query;

        let query = {};
        if (status) query.orderStatus = status;
        if (start && end) {
            query.createdAt = { $gte: new Date(start), $lte: new Date(end) };
        }

        const orders = await Order.find(query).populate("user", "username email");
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};


const adminCancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return next(new CustomError(404, "Order not found"));

        order.orderStatus = "Cancelled";
        await order.save();

        res.status(200).json({ success: true, message: "Order cancelled by admin" });
    } catch (error) {
        next(error);
    }
};


const getAnalytics = async (req, res, next) => {
  try {
    const totalSales = await Order.aggregate([
      { $match: { paymentStatus: "Paid" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const bestSellers = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$_id",
          productName: "$product.name",
          productSlug: "$product.slug",
          productPrice: "$product.price",
          productImage: "$product.images", // adjust this if images are stored differently
          totalSold: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSales: totalSales[0] || { totalRevenue: 0, totalOrders: 0 },
        bestSellers
      }
    });
  } catch (error) {
    next(error);
  }
};



module.exports = {
    createOrder,
    getUserOrders,
    getSingleOrder,
    markOrderAsPaid,
    updateOrderStatus,
    getMyOrders,
    cancelOrder,
    filterOrders,
    adminCancelOrder,
    getAnalytics,
    // isAdmin
};
