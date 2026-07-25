const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    businessName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    profilePics: {
      url: String,
      public_id: String,
    },

    // ======================================================
    // ACCOUNT TYPE
    // ======================================================

    role: {
      type: String,
      enum: ["user","stockist", "admin"],
      default: "user",
    },

    accountTypeRequested: {
      type: String,
      enum: [
        "retailer",
        "wholesaler",
        "distributor"
      ]
    },

    // ======================================================
    // DISTRIBUTOR ACCOUNT
    // ======================================================

    assignedTier: {
      type: String,
      enum: [
        "retailer",
        "wholesaler",
        "distributor_local",
        "distributor_international",
      ],
      default: null,
    },

    territory: {
      type: String,
      trim: true,
      default: null,
    },

    monthlyCommitmentPcs: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "SUSPENDED",
      ],
      default: "APPROVED",
    },

    // ======================================================
    // AUTH
    // ======================================================

    otp: {
      type: String,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },

    refreshToken: {
      type: String,
      select: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    // ======================================================
    // DISTRIBUTOR APPLICATION
    // ======================================================

    distributorApplication: {
      applied: {
        type: Boolean,
        default: false,
      },

      projectedMonthlyVolumePcs: {
        type: Number,
        default: null,
      },

      appliedAt: {
        type: Date,
      },

      approvedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);