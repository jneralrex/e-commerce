const express = require("express");

const {
    startPayment,
    verifyPayment,
    paystackWebhook,
} = require("../controllers/payment.controllers");
const authenticate = require("../utils/authenticate");

const router = express.Router();

// Initialize payment
router.post(
    "/:orderId/start",
    authenticate,
    startPayment
);

// Verify payment after redirect
router.get(
    "/verify",
    authenticate,
    verifyPayment
);

//webhook route for paystack
router.post(
    "/webhook",
    paystackWebhook
);

module.exports = router;