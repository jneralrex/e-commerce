const mongoose = require("mongoose");
const cartItemSchema = new mongoose.Schema({

    product:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Product",
        required:true
    },

    cartons:{
        type:Number,
        required:true,
        min:1
    }

},{_id:false});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    items: [cartItemSchema],

    resolvedTier: {
      type: String,
      enum: [
        "retailer",
        "wholesaler",
        "distributor_local",
        "distributor_international",
      ],
      default: null,
    },

    currency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
    },

    total_cartons: {
      type: Number,
      default: 0,
    },

    total_pcs: {
      type: Number,
      default: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Cart", cartSchema);