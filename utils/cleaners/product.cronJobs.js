const cron = require("node-cron");
const Order = require("../../models/order.model");

// Auto-cancel unpaid orders after 24 hours
const autoCancelUnpaidOrders = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const orders = await Order.updateMany(
        {
          paymentStatus: "Pending",
          createdAt: { $lte: twentyFourHoursAgo },
          orderStatus: "Processing"
        },
        { $set: { orderStatus: "Cancelled" } }
      );

      console.log(`✅ Auto-cancelled ${orders.modifiedCount} unpaid orders.`);
    } catch (error) {
      console.error("❌ Cron job error:", error.message);
    }
  });
};

module.exports = autoCancelUnpaidOrders;
