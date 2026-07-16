const User = require("../models/user.model");
const CustomError = require("../utils/errors/customErrors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const sendEmail = require("../utils/emails/emailSender");
const { deleteFromCloudinary } = require("./user.controller");

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
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email }).exec();
        if (existingUser) throw new CustomError(400, "User already exists", "AuthenticationError");

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,}$/;
        if (!passwordRegex.test(password)) {
            throw new CustomError(401, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number", "ValidationError");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { otp, otpExpiresAt } = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);

        const newUser = new User({
            username,
            email,
            password: passwordHash,
            otp: hashedOTP,
            otpExpiresAt,
            isVerified: false,
        });

        await newUser.save({ session });
        await session.commitTransaction();
        session.endSession();

        if (!newUser) {
            throw new CustomError(500, "User instantiation pipeline tracking broke.", "DatabaseError");
        }

        console.log("Generated OTP for user:", otp);

        const emailHtmlBody = `
            <p>Hello <strong>${username}</strong>,</p>
            <p>Thank you for registering with Sartor Health. Please use the verification code below to activate your account:</p>
            <div style="background: #f4f7fb; padding: 24px; text-align: center; border-radius: 8px; margin: 25px 0; border: 1px dashed #e2e8f0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #1a237e; font-family: monospace;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #718096;">This code is sensitive and will expire in 10 minutes.</p>
        `;

        const emailResult = await sendEmail(email, "Welcome to Sartor Health - Verify Your Account", emailHtmlBody, username);


        res.status(201).json({ success: true, message: "OTP sent to email. Please verify your account.", data: { email } });

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
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email.trim() }).select("+otp +otpExpiresAt");


        console.log("Fetched user:", user); // Add this

        if (!user) throw new CustomError(401, "User not found", "AuthenticationError");
        if (user.isVerified) throw new CustomError(400, "User is already verified", "ValidationError");

        console.log("Received OTP from request:", otp);
        console.log("Stored OTP in DB:", user.otp);

        if (!otp || !user.otp) {
            throw new CustomError(401, "OTP expired or invalid", "AuthenticationError");
        }

        // Check if OTP is expired
        if (Date.now() > user.otpExpiresAt) {
            await generateAndSendOTP(user);
            return res.status(400).json({ success: false, message: "OTP expired. A new OTP has been sent." });
        }

        // Verify OTP (Ensure it's a string)
        const otpMatch = await bcrypt.compare(otp.toString(), user.otp);
        if (!otpMatch) throw new CustomError(401, "Invalid OTP", "AuthenticationError");

        // Activate account
        user.isVerified = true;
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        res.status(200).json({ success: true, message: "Account verified successfully" });

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

        if (!email && !password) throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        if (!email) throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        if (!password) throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])\S{8,}$/;
        if (!passwordRegex.test(password)) {
            throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        }
        if (!email || !password) {
            throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        }
        if (!email.match(/^\S+@\S+\.\S+$/)) {
            throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        }
        const user = await User.findOne({ email }).select("+password +refreshToken");

        if (!user) throw new CustomError(401, "Invalid email or password", "AuthenticationError");
        if (!user.isVerified) throw new CustomError(401, "Account not verified", "AuthenticationError");

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) throw new CustomError(401, "Invalid email or password", "AuthenticationError");

        // Generate new tokens
        const accessToken = jwt.sign({ id: user._id }, config.jwt_secret, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user._id }, config.refresh_secret, { expiresIn: "7d" });

        // Store refresh token in DB
        user.refreshToken = refreshToken;
        await user.save();

        // Send refresh token as HTTP-only cookie
        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({ success: true, accessToken, user: { username: user.username, email: user.email } });

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
