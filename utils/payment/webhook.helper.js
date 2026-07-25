/**
 * Verify Paystack webhook signature
 */
const crypto = require("crypto");
const CustomError = require("../errors/customErrors");

const verifyWebhookSignature = (
    rawBody,
    signature
) => {

    const hash = crypto
        .createHmac(
            "sha512",
            process.env.PAYSTACK_SECRET_KEY
        )
        .update(rawBody)
        .digest("hex");

    return hash === signature;

};


module.exports = {
    verifyWebhookSignature,
};