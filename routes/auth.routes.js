const express = require("express");
const { signUp, verifyOTP, resendOTP, signIn, refreshToken, logout, forgotPassword, resetPassword, changePassword, requestDeleteAccount, confirmDeleteAccount } = require("../controllers/auth.controller");
const authenticate = require("../utils/authenticate");


const router = express.Router();

router.post("/signup", signUp);          // Register user & send OTP
router.post("/verify-otp", verifyOTP);   // Verify OTP & activate account
router.post("/resend-otp", resendOTP);   // Resend OTP
router.post("/signin", signIn);          // User login
router.post("/refresh-token", refreshToken); // Refresh access token
router.post("/logout", logout);          // Logout user
router.post("/forgot-password", forgotPassword);          // Forgot password
router.post("/reset-password", resetPassword);          // Reset password
router.put("/change-password", authenticate, changePassword);        // Reset password
router.post("/request-delete", authenticate, requestDeleteAccount);        // Request delete account
router.post("/confirm-delete", authenticate, confirmDeleteAccount);        // Confirm delete account





module.exports = router;
