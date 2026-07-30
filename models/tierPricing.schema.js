// schemas/tierPricing.schema.js

const mongoose = require("mongoose");

const TierPricingSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      required: true,
    },

    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },

    moq: {
      type: Number,
      required: true,
      min: 1,
    },

    self_service: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

module.exports = TierPricingSchema;