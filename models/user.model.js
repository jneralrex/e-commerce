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
      required: true,
      trim: true,
    },

    businessRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
    },

    businessType: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      required: true,
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
      required: true,
      trim: true,
    },

    profilePics: {
      url: String,
      public_id: String,
    },

    role: {
      type: String,
      enum: ["user", "stockist", "admin"],
      default: "user",
    },

    accountTypeRequested: {
      type: String,
      enum: [
        "retailer",
        "wholesaler",
        "distributor_local",
        "distributor_international",
      ],
    },

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

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "SUSPENDED",
        "BLOCKED",
      ],
      default: "APPROVED",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    estimatedMonthlyOrderVolume: {
      type: String,
      trim: true,
      default: null,
    },

    businessDescription: {
      type: String,
      trim: true,
      default: null,
    },

    marketingOptIn: {
      type: Boolean,
      default: false,
    },

    territory: {
      type: String,
      trim: true,
      default: null,
    },

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

    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model("User", userSchema);
