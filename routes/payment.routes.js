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

// Paystack webhook
// This route MUST receive the raw request body
router.post(
    "/webhook",
    express.raw({
        type: "application/json",
    }),
    paystackWebhook
);

module.exports = router;