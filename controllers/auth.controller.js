const User = require("../models/user.model");
const CustomError = require("../utils/errors/customErrors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const sendEmail = require("../utils/emails/emailSender");
const { deleteFromCloudinary } = require("./user.controller");
const axios = require("axios");
const crypto = require("crypto");
const { TIERS } = require("../constants/tier.constants");


const generateOTP = () => ({
    otp: Math.floor(100000 + Math.random() * 900000).toString(),
    otpExpiresAt: Date.now() + 10 * 60 * 1000,
});


const generateAndSendOTP = async (user) => {
    const { otp, otpExpiresAt } = generateOTP();
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    // Isolated HTML body template literal block scope
    const resendHtmlBody = `
        <p>Hello <strong>${user.username || 'User'}</strong>,</p>
        <p>A new verification code has been generated for your account. Please use the OTP below:</p>
        <div style="background: #f4f7fb; padding: 24px; text-align: center; border-radius: 8px; margin: 25px 0; border: 1px dashed #e2e8f0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #1a237e; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #718096;">This code is sensitive and will expire in 10 minutes.</p>
    `;

    const emailResult = await sendEmail(user.email, "Your New OTP Code", resendHtmlBody, user.username);
    if (!emailResult.success) {
        throw new CustomError(502, `Failed to deliver new OTP: ${emailResult.error}`, "GatewayError");
    }
};

/** ===========================
 *  USER REGISTRATION (SEND OTP)
 *  =========================== */
const signUp = async (req, res, next) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    const {
      businessName,
      businessRegistrationNumber,
      businessType,
      country,
      contactPerson,
      phoneNumber,
      email,
      accountTypeRequested,
      estimatedMonthlyOrderVolume,
      businessDescription,
      marketingOptIn,
    } = req.body;

    /**
     * ==========================================
     * BASIC VALIDATION
     * ==========================================
     */

    if (!businessName?.trim()) {
      throw new CustomError(
        400,
        "Business name is required.",
        "ValidationError"
      );
    }

    if (!businessRegistrationNumber?.trim()) {
      throw new CustomError(
        400,
        "Business registration number is required.",
        "ValidationError"
      );
    }

    if (!businessType?.trim()) {
      throw new CustomError(
        400,
        "Business type is required.",
        "ValidationError"
      );
    }

    if (!country?.trim()) {
      throw new CustomError(
        400,
        "Country is required.",
        "ValidationError"
      );
    }

    if (!contactPerson?.trim()) {
      throw new CustomError(
        400,
        "Contact person is required.",
        "ValidationError"
      );
    }

    if (!phoneNumber?.trim()) {
      throw new CustomError(
        400,
        "Phone / WhatsApp number is required.",
        "ValidationError"
      );
    }

    if (!email?.trim()) {
      throw new CustomError(
        400,
        "Business email is required.",
        "ValidationError"
      );
    }

    /**
     * ==========================================
     * EMAIL VALIDATION
     * ==========================================
     */

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      throw new CustomError(
        400,
        "Please provide a valid business email.",
        "ValidationError"
      );
    }

    /**
     * ==========================================
     * ACCOUNT / TIER VALIDATION
     * ==========================================
     *
     * Frontend sends the actual tier:
     *
     * retailer
     * wholesaler
     * distributor_local
     * distributor_international
     */

    const allowedTiers = [
      TIERS.RETAILER,
      TIERS.WHOLESALER,
      TIERS.DISTRIBUTOR_LOCAL,
      TIERS.DISTRIBUTOR_INTERNATIONAL,
    ];

    if (!allowedTiers.includes(accountTypeRequested)) {
      throw new CustomError(
        400,
        "Invalid partnership type selected.",
        "ValidationError"
      );
    }

    /**
     * ==========================================
     * CHECK EXISTING EMAIL
     * ==========================================
     */

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      throw new CustomError(
        400,
        "An account already exists with this email.",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * ACCOUNT STATUS
     * ==========================================
     *
     * Distributor applications require manual
     * approval.
     *
     * Retailer and wholesaler applications
     * follow the normal approved workflow.
     */

    const status =
      accountTypeRequested === TIERS.DISTRIBUTOR_LOCAL ||
      accountTypeRequested === TIERS.DISTRIBUTOR_INTERNATIONAL
        ? "PENDING"
        : "APPROVED";

    /**
     * ==========================================
     * INITIAL PASSWORD
     * ==========================================
     *
     * The frontend does not collect a password.
     *
     * We create an internal temporary password
     * so the User document satisfies the password
     * requirement.
     *
     * The plaintext password is NEVER stored.
     *
     * A new temporary password will be generated
     * and emailed after OTP verification.
     */

   
    

    /**
     * ==========================================
     * OTP
     * ==========================================
     */

    const {
      otp,
      otpExpiresAt,
    } = generateOTP();

    const hashedOTP =
      await bcrypt.hash(
        otp,
        10
      );

    /**
     * ==========================================
     * CREATE USER
     * ==========================================
     */

    const newUser = new User({

      // Business name serves as username
      username:
        businessName.trim(),

      businessName:
        businessName.trim(),

      businessRegistrationNumber:
        businessRegistrationNumber.trim(),

      businessType:
        businessType.trim(),

      country:
        country.trim(),

      contactPerson:
        contactPerson.trim(),

      phoneNumber:
        phoneNumber.trim(),

      email:
        normalizedEmail,

      password:
        hashedPassword,

      role:
        "stockist",

      /**
       * Actual tier submitted by frontend.
       */
      accountTypeRequested:
        accountTypeRequested,

      status,

      /**
       * Purchasing engine uses this to determine
       * the user's base tier.
       */
      assignedTier:
        accountTypeRequested,

      /**
       * User must change the temporary password
       * after receiving it.
       */
      mustChangePassword:
        true,

      territory:
        null,

      projectedMonthlyVolumePcs:
        0,

      estimatedMonthlyOrderVolume:
        estimatedMonthlyOrderVolume?.trim() ||
        null,

      businessDescription:
        businessDescription?.trim() ||
        null,

      marketingOptIn:
        marketingOptIn === true ||
        marketingOptIn === "true",

      otp:
        hashedOTP,

      otpExpiresAt,

      isVerified:
        false,
    });

    await newUser.save({
      session,
    });

    await session.commitTransaction();
    session.endSession();

    /**
     * ==========================================
     * SEND OTP EMAIL
     * ==========================================
     */

    const emailHtmlBody = `
      <p>
        Hello <strong>${contactPerson.trim()}</strong>,
      </p>

      <p>
        Thank you for applying for partner
        access with Sartor Health.
      </p>

      <p>
        Please verify your business email
        using the OTP below:
      </p>

      <div
        style="
          background:#f4f7fb;
          padding:24px;
          text-align:center;
          border-radius:8px;
        "
      >
        <span
          style="
            font-size:36px;
            font-weight:bold;
            letter-spacing:6px;
          "
        >
          ${otp}
        </span>
      </div>

      <p>
        This verification code expires in
        10 minutes.
      </p>

      <p>
        After verification, you will receive
        a temporary password by email.
      </p>

      <p>
        You will be required to change this
        password when you first sign in.
      </p>
    `;

    const emailResult =
      await sendEmail(
        normalizedEmail,
        "Verify Your Sartor Health Partner Application",
        emailHtmlBody,
        contactPerson.trim()
      );

    if (!emailResult.success) {
      throw new CustomError(
        502,
        "Application was submitted, but we could not send the verification email.",
        "GatewayError"
      );
    }

    /**
     * ==========================================
     * RESPONSE
     * ==========================================
     */

    return res.status(201).json({
      success: true,

      message:
        "Partner application submitted successfully. Please verify your email.",

      data: {
        email:
          normalizedEmail,

        accountTypeRequested:
          accountTypeRequested,

        assignedTier:
          accountTypeRequested,

        businessName:
          businessName.trim(),

        status,
      },
    });

  } catch (error) {

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    session.endSession();

    next(error);
  }
};


/** ==============================
 *  VERIFY OTP & ACTIVATE ACCOUNT
 *  ============================== */

const verifyOTP = async (req, res, next) => {
  try {
    const {
      email,
      otp,
    } = req.body;

    if (!email?.trim()) {
      throw new CustomError(
        400,
        "Email is required.",
        "ValidationError"
      );
    }

    if (!otp) {
      throw new CustomError(
        400,
        "OTP is required.",
        "ValidationError"
      );
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      }).select(
        "+otp +otpExpiresAt +password"
      );

    if (!user) {
      throw new CustomError(
        401,
        "User not found.",
        "AuthenticationError"
      );
    }

    if (user.isVerified) {
      throw new CustomError(
        400,
        "User is already verified.",
        "ValidationError"
      );
    }

    if (!user.otp || !user.otpExpiresAt) {
      throw new CustomError(
        401,
        "OTP expired or invalid.",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * CHECK OTP EXPIRATION
     * ==========================================
     */

    if (
      Date.now() >
      new Date(user.otpExpiresAt).getTime()
    ) {

      await generateAndSendOTP(user);

      return res.status(400).json({
        success: false,
        message:
          "OTP expired. A new OTP has been sent to your email.",
      });
    }

    /**
     * ==========================================
     * VERIFY OTP
     * ==========================================
     */

    const otpMatch =
      await bcrypt.compare(
        otp.toString(),
        user.otp
      );

    if (!otpMatch) {
      throw new CustomError(
        401,
        "Invalid OTP.",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * GENERATE TEMPORARY PASSWORD
     * ==========================================
     *
     * This password is generated ONLY after
     * successful email verification.
     *
     * Plaintext exists only in memory long enough
     * to send the email.
     */

    const temporaryPassword =
      `${crypto.randomBytes(12).toString("base64url")}Aa1!`;

    const hashedPassword =
      await bcrypt.hash(
        temporaryPassword,
        10
      );

    /**
     * ==========================================
     * ACTIVATE ACCOUNT
     * ==========================================
     */

    user.isVerified = true;

    user.otp = null;
    user.otpExpiresAt = null;

    user.password =
      hashedPassword;

    user.mustChangePassword =
      true;

    await user.save();

    /**
     * ==========================================
     * SEND TEMPORARY PASSWORD
     * ==========================================
     */

    const passwordEmailBody = `
      <p>
        Hello <strong>${user.contactPerson}</strong>,
      </p>

      <p>
        Your Sartor Health partner account has
        been successfully verified.
      </p>

      <p>
        Your temporary password is:
      </p>

      <div
        style="
          background:#f4f7fb;
          padding:24px;
          text-align:center;
          border-radius:8px;
          margin:20px 0;
        "
      >
        <span
          style="
            font-size:24px;
            font-weight:bold;
            letter-spacing:2px;
          "
        >
          ${temporaryPassword}
        </span>
      </div>

      <p>
        Your username is your registered business
        name:
      </p>

      <div
        style="
          background:#f4f7fb;
          padding:16px;
          border-radius:8px;
          margin:15px 0;
        "
      >
        <strong>${user.businessName}</strong>
      </div>

      <p>
        Please use these credentials to sign in.
      </p>

      <p>
        For security reasons, you will be required
        to change your temporary password after
        your first successful login.
      </p>

      ${
        user.status === "PENDING"
          ? `
            <p>
              Your account is currently pending
              partner approval. You may sign in,
              but access to purchasing features
              will remain subject to your account
              approval.
            </p>
          `
          : ""
      }

      <p>
        If you did not submit this application,
        please contact Sartor Health support
        immediately.
      </p>
    `;

    const emailResult =
      await sendEmail(
        user.email,
        "Your Sartor Health Temporary Password",
        passwordEmailBody,
        user.contactPerson
      );

    if (!emailResult.success) {
      /**
       * The account is already verified at this
       * point, but the password email failed.
       *
       * Do NOT return the temporary password in
       * the API response.
       */

      throw new CustomError(
        502,
        "Your email has been verified, but we could not send your temporary password. Please request a new password.",
        "GatewayError"
      );
    }

    /**
     * ==========================================
     * RESPONSE
     * ==========================================
     */

    return res.status(200).json({
      success: true,

      message:
        "Account verified successfully. A temporary password has been sent to your email. Please use it to sign in and change your password.",

      data: {
        email:
          user.email,

        username:
          user.businessName,

        assignedTier:
          user.assignedTier,

        mustChangePassword:
          true,

        status:
          user.status,
      },
    });

  } catch (error) {
    next(error);
  }
};

/** ===========================
 *  RESEND OTP
 *  =========================== */
const resendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.trim() });

        if (!user) throw new CustomError(401, "User not found", "ValidationError");
        if (user.isVerified) throw new CustomError(400, "User is already verified", "ValidationError");

        // Generate and send new OTP
        await generateAndSendOTP(user);

        res.status(200).json({ success: true, message: "New OTP sent to your email.", data: { email } });

    } catch (error) {
        next(error);
    }
};

/** ===========================
 *  USER LOGIN (GENERATE TOKENS)
 *  =========================== */


const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    /**
     * ==========================================
     * BASIC VALIDATION
     * ==========================================
     */

    if (!email?.trim() || !password) {
      throw new CustomError(
        400,
        "Invalid email or password",
        "AuthenticationError"
      );
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /**
     * ==========================================
     * FIND USER
     * ==========================================
     */

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+password +refreshToken"
    );

    if (!user) {
      throw new CustomError(
        401,
        "Invalid email or password",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * EMAIL VERIFICATION
     * ==========================================
     */

    if (!user.isVerified) {
      throw new CustomError(
        401,
        "Account not verified",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * ACCOUNT STATUS
     * ==========================================
     */

    if (user.status === "SUSPENDED") {
      throw new CustomError(
        403,
        "Your account has been suspended. Please contact support.",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * BLOCKED ACCOUNT
     * ==========================================
     */

    if (user.isBlocked || user.status === "BLOCKED") {
      throw new CustomError(
        403,
        "Your account has been blocked. Please contact support.",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * PASSWORD
     * ==========================================
     */

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      throw new CustomError(
        401,
        "Invalid email or password",
        "AuthenticationError"
      );
    }

    /**
     * ==========================================
     * ACCESS TOKEN
     * ==========================================
     */

    const accessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      config.jwt_secret,
      {
        expiresIn: "15m",
      }
    );

    /**
     * ==========================================
     * REFRESH TOKEN
     * ==========================================
     */

    const refreshToken = jwt.sign(
      {
        id: user._id,
      },
      config.refresh_secret,
      {
        expiresIn: "7d",
      }
    );

    user.refreshToken =
      refreshToken;

    await user.save();

    /**
     * ==========================================
     * REFRESH TOKEN COOKIE
     * ==========================================
     */

    res.cookie(
      "refreshToken",
      refreshToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge:
          7 *
          24 *
          60 *
          60 *
          1000,
      }
    );

    /**
     * ==========================================
     * RESPONSE
     * ==========================================
     */

    return res.status(200).json({
      success: true,

      accessToken,

      user: {
        id: user._id,

        username:
          user.username,

        businessName:
          user.businessName,

        businessRegistrationNumber:
          user.businessRegistrationNumber,

        businessType:
          user.businessType,

        country:
          user.country,

        contactPerson:
          user.contactPerson,

        email:
          user.email,

        phoneNumber:
          user.phoneNumber,

        role:
          user.role,

        status:
          user.status,

        /**
         * Purchasing engine uses this
         * as the user's base tier.
         */
        assignedTier:
          user.assignedTier,

        accountTypeRequested:
          user.accountTypeRequested,

        territory:
          user.territory,

        monthlyCommitmentPcs:
          user.monthlyCommitmentPcs,

        estimatedMonthlyOrderVolume:
          user.estimatedMonthlyOrderVolume,

        businessDescription:
          user.businessDescription,

        marketingOptIn:
          user.marketingOptIn,

        distributorApplication:
          user.distributorApplication,

        /**
         * Frontend uses this to determine
         * whether the user must change the
         * temporary password.
         */
        mustChangePassword:
          user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};



/** ===========================
 *  REFRESH TOKEN
 *  =========================== */
const refreshToken = async (req, res) => {
    try {
        const tokenFromCookie = req.cookies.refreshToken;
        if (!tokenFromCookie) {
            return res.status(401).json({ success: false, message: "No refresh token provided" });
        }

        const decoded = jwt.verify(tokenFromCookie, config.refresh_secret);
        const user = await User.findById(decoded.id).select("+refreshToken");

        if (!user || user.refreshToken !== tokenFromCookie) {
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }

        // Rotate refresh token
        const newRefreshToken = jwt.sign({ id: user._id }, config.refresh_secret, { expiresIn: "7d" });
        user.refreshToken = newRefreshToken;
        await user.save();

        const newAccessToken = jwt.sign(
            { id: user._id, role: user.role },
            config.jwt_secret,
            { expiresIn: "15m" }
        );

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, accessToken: newAccessToken });
    } catch (error) {
        return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }
};

// ** ===========================
//  *  LOGOUT (INVALIDATE REFRESH TOKEN)
//  *  =========================== */

const logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) throw new CustomError(401, "No refresh token provided", "AuthorizationError");

        const user = await User.findOne({ refreshToken });
        if (!user) throw new CustomError(401, "Invalid refresh token", "AuthorizationError");

        user.refreshToken = null;
        await user.save();

        // Clear cookie
        res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "Strict" });

        res.status(200).json({ success: true, message: "Logged out successfully" });

    } catch (error) {
        next(error);
    }
};

/** ===========================
 *  FORGOT PASSWORD (SEND OTP)
 *  =========================== */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) throw new CustomError(401, "User not found", "ValidationError");

        await generateAndSendOTP(user);

        res.status(200).json({ success: true, message: "Password reset OTP sent to email." });

    } catch (error) {
        next(error);
    }
};

/** ===========================
 *  RESET PASSWORD (VERIFY OTP & UPDATE PASSWORD)
 *  =========================== */
const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email }).select("+otp +otpExpiresAt");
        if (!user) throw new CustomError(401, "User not found", "ValidationError");

        if (!otp || !user.otp) {
            throw new CustomError(401, "OTP expired or invalid", "ValidationError");
        }

        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char, and NO spaces
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,}$/;

        if (!passwordRegex.test(newPassword)) {
            throw new CustomError(
                400,
                "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, one special character (e.g., !@#$%^&*(),.?\":{}|<>), and must not contain spaces.",
                "ValidationError"
            );
        }

        // Check if OTP is expired
        if (Date.now() > user.otpExpiresAt) {
            await generateAndSendOTP(user);
            return res.status(400).json({ success: false, message: "OTP expired. A new OTP has been sent." });
        }

        // Verify OTP (Ensure it's a string)
        const otpMatch = await bcrypt.compare(otp.toString(), user.otp);
        if (!otpMatch) throw new CustomError(400, "Invalid OTP", "ValidationError");

        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        res.status(200).json({ success: true, message: "Password reset successfully" });

    } catch (error) {
        next(error);
    }
};

/** ===========================
 *  CHANGE PASSWORD (LOGGED-IN USER)
 *  =========================== */
const changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!newPassword) throw new CustomError(400, "New password is required", "ValidationError");
        if (!oldPassword) throw new CustomError(400, "Old password is required", "ValidationError");
        if (newPassword === oldPassword) throw new CustomError(400, "New password cannot be the same as old password", "ValidationError");

        const user = await User.findById(req.user._id).select("+password");

        if (!user) throw new CustomError(401, "User not found", "ValidationError");

        const passwordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordMatch) throw new CustomError(400, "Old password is incorrect", "ValidationError");


        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char, and NO spaces
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,}$/;

        if (!passwordRegex.test(newPassword)) {
            throw new CustomError(
                400,
                "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, one special character (e.g., !@#$%^&*(),.?\":{}|<>), and must not contain spaces.",
                "ValidationError"
            );
        }


        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ success: true, message: "Password changed successfully" });

    } catch (error) {
        next(error);
    }
};

/**
 Send OTP Before Deleting Account
 */
const requestDeleteAccount = async (req, res, next) => {
    try {
        const userId = req.user._id; // Get user ID from the logged-in user
        const user = await User.findById(userId).select("+otp +otpExpiresAt");
        if (!user) throw new CustomError(404, "User not found", "ValidationError");

        // Generate and send OTP
        const { otp, otpExpiresAt } = generateOTP();
        user.otp = await bcrypt.hash(otp, 10); // Hash OTP
        user.otpExpiresAt = otpExpiresAt;
        await user.save();

        sendEmail(user.email, "Please note that this action cannot be undone if you confirm your account deletion, kinldy ignore and chage your password if you did not make this request", `The OTP for your account deletion is: ${otp}. It expires in 10 minutes.`);

        res.status(200).json({ success: true, message: "OTP sent to email for account deletion confirmation." });

    } catch (error) {
        next(error);
    }
};


const confirmDeleteAccount = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId).select("+otp +otpExpiresAt");
        if (!user) throw new CustomError(404, "User not found", "ValidationError");

        // Check if OTP is expired
        if (Date.now() > user.otpExpiresAt) {
            await requestDeleteAccount(req, res, next); // Resend OTP if expired
            return res.status(400).json({ success: false, message: "OTP expired. A new OTP has been sent." });
        }

        // Verify OTP
        const otpMatch = await bcrypt.compare(otp.toString(), user.otp);
        if (!otpMatch) throw new CustomError(400, "Invalid OTP", "ValidationError");

        // Delete profile picture from Cloudinary
        if (user.profilePics && user.profilePics.public_id) {
            await deleteFromCloudinary(user.profilePics.public_id);
        }

        // Delete user account
        await User.findByIdAndDelete(userId);

        res.status(200).json({ success: true, message: "Account deleted successfully." });

    } catch (error) {
        next(error);
    }
};

module.exports = { signUp, verifyOTP, signIn, refreshToken, logout, resendOTP, resetPassword, changePassword, forgotPassword, requestDeleteAccount, confirmDeleteAccount };
