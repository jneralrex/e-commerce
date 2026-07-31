const mongoose = require("mongoose");
const Cart = require("../models/cart.model");
const Order = require("../models/order.model");
const OrderLine = require("../models/orderline.model");
const CustomError = require("../utils/errors/customErrors");
const { recalculateCart, calculateCartLine, } = require("../service/tier.service");
const Payment = require("../models/payment.model");


const formatOrderResponse = (hydratedOrder) => {
  const responseOrder = hydratedOrder.toObject();

  if (!responseOrder.orderLines || !Array.isArray(responseOrder.orderLines)) {
    return responseOrder;
  }

  responseOrder.orderLines = responseOrder.orderLines.map((line) => {
    const cartonSize = Number(line.carton_size_pcs || 1);
    const totalPcs = Number(line.pcs || 0);

    const cartons = Math.floor(totalPcs / cartonSize);
    const loosePcs = totalPcs % cartonSize;

    return {
      ...line,
      cartons,
      loose_pcs: loosePcs,
      display_quantity: loosePcs === 0
        ? `${cartons} cartons`
        : `${cartons} cartons and ${loosePcs} pcs`
    };
  });

  return responseOrder;
};


const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { shippingAddress } = req.body;

        const cart = await Cart.findOne({
            user: req.user._id,
        }).session(session);

        if (!cart || cart.items.length === 0) {
            throw new CustomError(
                400,
                "Cart is empty",
                "ValidationError"
            );
        }

        // Recalculate cart using latest product data
        const {
            cart: updatedCart,
            productMap,
        } = await recalculateCart(
            cart,
            req.user
        );

        await updatedCart.save({ session });

        const createdOrder = (
            await Order.create(
                [
                    {
                        account: req.user._id,

                        currency: updatedCart.currency,

                        total_cartons: updatedCart.total_cartons,

                        total_pcs: updatedCart.total_pcs,

                        total_amount: updatedCart.subtotal,

                        shippingAddress,

                        orderStatus: "AWAITING_PAYMENT",
                    },
                ],
                { session }
            )
        )[0];

        const paymentRef = `PAY-${Date.now()}-${createdOrder._id
            .toString()
            .slice(-6)
            .toUpperCase()}`;

        const payment = await Payment.create(
            [
                {
                    order: createdOrder._id,
                    account: req.user._id,
                    payment_ref: paymentRef,
                    amount: updatedCart.subtotal,
                    currency: updatedCart.currency,
                    status: "PENDING",
                },
            ],
            { session }
        );

        const createdPayment = payment[0];

        createdOrder.payment = createdPayment._id;

        const orderLineIds = [];

        for (const item of updatedCart.items) {

            const product =
                productMap[item.product.toString()];

            if (!product) {
                throw new CustomError(
                    404,
                    "Product no longer exists."
                );
            }

            const line = calculateCartLine(
                req.user,
                product,
                item.pcs
            );

            if (product.stock_pcs < line.pcs) {
                throw new CustomError(
                    400,
                    `${product.name} has only ${product.stock_pcs} pcs remaining.`,
                    "StockError"
                );
            }

            const stockBeforePurchase = product.stock_pcs;

            product.stock_pcs -= line.pcs;

            await product.save({ session });

            const orderLine = (
                await OrderLine.create(
                    [{
                        order: createdOrder._id,
                        product: product._id,

                        category: product.category,
                        product_name: product.name,
                        product_slug: product.slug,
                        sku: product.sku,
                        barcode: product.barcode,
                        brand: product.brand,
                        model: product.model,
                        primary_image: product.images?.[0] || null,

                        carton_size_pcs: product.carton_size_pcs,
                        carton_weight_kg: product.carton_weight_kg,
                        carton_length_cm: product.carton_length_cm,
                        carton_width_cm: product.carton_width_cm,
                        carton_height_cm: product.carton_height_cm,

                        display_quantity:
                            line.loose_pcs === 0
                                ? `${line.cartons} cartons`
                                : `${line.cartons} cartons and ${line.loose_pcs} pcs`,

                        cartons: line.cartons,
                        pcs: line.pcs,
                        loose_pcs: line.loose_pcs,

                        unit_price: line.unit_price,
                        line_total: line.line_total,

                        discount: product.discount,

                        currency: line.currency,
                        tier_used: line.tier_used,
                        base_tier: line.base_tier,
                        next_tier: line.next_tier,
                        message: line.message,

                        stock_before_purchase: stockBeforePurchase,
                        stock_after_purchase: product.stock_pcs,
                    }],
                    { session }
                )
            )[0];

            orderLineIds.push(orderLine._id);
        }

        createdOrder.orderLines = orderLineIds;

        await createdOrder.save({ session });

        // Delete cart after successful order creation
        await Cart.findOneAndDelete(
            {
                user: req.user._id,
            },
            { session }
        );

        await session.commitTransaction();

        const completedOrder = await Order.findById(
            createdOrder._id
        )
            .populate("account", "fullname email")
            .populate("payment")
            .populate("orderLines");

        res.status(201).json({
            success: true,
            message: "Order created successfully.",
            order: completedOrder,
        });

    } catch (error) {

        await session.abortTransaction();

        next(error);

    } finally {

        session.endSession();

    }
};


const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      account: req.user._id,
    })
      .populate("orderLines")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => formatOrderResponse(order));

    return res.status(200).json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    next(error);
  }
};



const getSingleOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("account", "username")
            .populate("orderLines");

        if (!order) {
            throw new CustomError(404, "Order not found");
        }

        if (
            req.user.role !== "admin" &&
            order.account.toString() !== req.user._id.toString()
        ) {
            throw new CustomError(403, "Unauthorized");
        }

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error) {
        next(error);
    }
};


const markOrderAsPaid = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            throw new CustomError(404, "Order not found");
        }

        order.paymentStatus = "PAID";
        order.orderStatus = "PAID";
        order.paidAt = new Date();

        await order.save();

        res.status(200).json({
            success: true,
            message: "Payment confirmed.",
            order,
        });
    } catch (error) {
        next(error);
    }
};


const updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            throw new CustomError(404, "Order not found");
        }

        order.orderStatus = status;

        await order.save();

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error) {
        next(error);
    }
};


// const getMyOrders = async (req, res, next) => {
//     try {
//         const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
//         res.status(200).json({ success: true, data: orders });
//     } catch (error) {
//         next(error);
//     }
// };


const cancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            throw new CustomError(404, "Order not found");
        }

        if (
            req.user.role !== "admin" &&
            order.account.toString() !== req.user._id.toString()
        ) {
            throw new CustomError(403, "Unauthorized");
        }

        if (order.paymentStatus === "PAID") {
            throw new CustomError(
                400,
                "Paid orders cannot be cancelled."
            );
        }

        order.orderStatus = "CANCELLED";

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order cancelled.",
        });
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

        const orders = await Order.find(query).populate("account", "fullname email")
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        next(error);
    }
};


const adminCancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return next(new CustomError(404, "Order not found"));

        order.orderStatus = "CANCELLED";
        await order.save();

        res.status(200).json({ success: true, message: "Order cancelled by admin" });
    } catch (error) {
        next(error);
    }
};


const getAnalytics = async (req, res, next) => {
    try {
        const totalSales = await Order.aggregate([
            { $match: { paymentStatus: "PAID" } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total_amount" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const bestSellers = await OrderLine.aggregate([

            {
                $lookup: {
                    from: "orders",
                    localField: "order",
                    foreignField: "_id",
                    as: "order"
                }
            },

            {
                $unwind: "$order"
            },

            {
                $match: {
                    "order.paymentStatus": "PAID"
                }
            },

            {
                $group: {
                    _id: "$product",

                    totalSoldPcs: {
                        $sum: "$pcs"
                    },

                    totalSoldCartons: {
                        $sum: "$cartons"
                    },

                    totalRevenue: {
                        $sum: "$line_total"
                    }
                }
            },

            {
                $sort: {
                    totalSoldPcs: -1
                }
            },

            {
                $limit: 5
            },

            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },

            {
                $unwind: "$product"
            },

            {
                $project: {
                    _id: 0,

                    productId: "$product._id",
                    productName: "$product.name",
                    slug: "$product.slug",
                    sku: "$product.sku",

                    image: {
                        $arrayElemAt: ["$product.images", 0]
                    },

                    totalSoldPcs: 1,
                    totalSoldCartons: 1,
                    totalRevenue: 1
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
    //    getUserOrders,
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
