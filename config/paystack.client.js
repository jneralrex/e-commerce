
const axios = require("axios");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is missing.");
}

const paystackClient = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

module.exports = paystackClient;