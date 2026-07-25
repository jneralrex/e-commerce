const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderLines: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OrderLine",
        },
      ],
      default: [],
    },

    currency: {
      type: String,
      enum: ["NGN", "USD"],
      required: true,
      default: "NGN",
    },

    resolvedTier: {
      type: String,
      enum: [
        "retailer",
        "wholesaler",
        "distributor_local",
        "distributor_international",
      ],
      required: true,
    },

    total_cartons: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    total_pcs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    total_amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    shippingAddress: {
      type: String,
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    orderStatus: {
      type: String,
      enum: [
        "DRAFT",
        "AWAITING_PAYMENT",
        "PAID",
        "PROCESSING",
        "PACKED",
        "SHIPPED", 
        "DELIVERED",
        "FULFILLED",
        "CANCELLED",
      ],
      default: "DRAFT",
    },

    payment_ref: {
      type: String,
      default: null,
      trim: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    proforma_url: {
      type: String,
      default: null,
      trim: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({
  account: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Order", orderSchema);