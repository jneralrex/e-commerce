const express = require("express");
const router = express.Router();
const authenticate = require("../utils/authenticate");
const { createCheckoutSession, stripeWebhookHandler } = require("../controllers/payment.controllers");

router.post("/create-checkout-session", authenticate, createCheckoutSession);
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);


module.exports = router;
