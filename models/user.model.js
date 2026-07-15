const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    profilePics: {
      url: { type: String },
      public_id: { type: String },
    },
    gender: { type: String, trim: true, lowercase: true, enum: ["male", "female"] },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          return value < new Date(); // Ensures DOB is in the past
        },
        message: "Date of birth cannot be in the future",
      },
    },
    race: { type: String, trim: true, lowercase: true },
    occupation: { type: String, trim: true, lowercase: true },
    maritalStatus: { type: String, trim: true, lowercase: true },
    habit: {
      smoking: { type: String, enum: ["No", "Yes", "Occasionally"], default: "No" },
      alcohol: { type: String, enum: ["No", "Yes", "Occasionally"], default: "No" },
    },
    hobbies: [{ type: String, trim: true, lowercase: true }],
    password: { type: String, required: true, select: false },
    otp: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    isVerified: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// **Pre-Save Hook to Update isProfileComplete Automatically**
userSchema.pre("save", function (next) {
  this.isProfileComplete =
    !!this.username &&
    !!this.email &&
    !!this.profilePics?.url &&
    !!this.gender &&
    !!this.dateOfBirth &&
    !!this.race &&
    !!this.occupation &&
    !!this.maritalStatus &&
    !!this.habit &&
    this.hobbies.length > 0;

  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
