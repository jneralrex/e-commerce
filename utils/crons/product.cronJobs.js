const cron = require("node-cron");

const Order = require("../../models/order.model");
const Product = require("../../models/product.model");

const {
    markPaymentAsAbandoned,
} = require("../../service/payment.service");

// Runs every hour
const autoCancelUnpaidOrders = () => {
    cron.schedule("0 * * * *", async () => {
        try {

            const twentyFourHoursAgo = new Date(
                Date.now() - 24 * 60 * 60 * 1000
            );

            const expiredOrders = await Order.find({
                paymentStatus: {
                    $in: [
                        "PENDING",
                        "FAILED",
                        "ABANDONED",
                    ],
                },
                orderStatus: "AWAITING_PAYMENT",
            })
                .populate("payment")
                .populate({
                    path: "orderLines",
                    populate: {
                        path: "product",
                    },
                });

            if (!expiredOrders.length) {
                console.log(
                    "No expired unpaid orders found."
                );
                return;
            }

            let cancelledOrders = 0;

            for (const line of order.orderLines) {

                const product = line.product;

                if (!product) {
                    continue;
                }

                product.stock_pcs += line.pcs;

                await product.save();
            }

            console.log(
                `Auto-cancelled ${cancelledOrders} unpaid order(s).`
            );

        } catch (error) {

            console.error(
                "Auto-cancel cron failed:",
                error.message
            );

        }
    });
};

module.exports = autoCancelUnpaidOrders;