/**
 * Verify Paystack webhook signature
 */
const crypto = require("crypto");
const CustomError = require("../errors/customErrors");

const verifyWebhookSignature = (
    rawBody,
    signature
) => {

    if (!signature) {
        throw new CustomError(
            400,
            "Missing Paystack signature.",
            "ValidationError"
        );
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new CustomError(
            500,
            "Paystack secret key is not configured.",
            "ConfigurationError"
        );
    }

    const hash = crypto
        .createHmac(
            "sha512",
            process.env.PAYSTACK_SECRET_KEY
        )
        .update(rawBody)
        .digest("hex");

    const expected = Buffer.from(hash);
    const received = Buffer.from(signature);

    if (expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        expected,
        received
    );
};


module.exports = {
    verifyWebhookSignature,
};