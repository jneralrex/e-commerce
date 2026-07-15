const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number
  }],
  totalAmount: Number,
  paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  orderStatus: { type: String, enum: ["Processing", "Shipped", "Delivered"], default: "Processing" },
  shippingAddress: String,
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
