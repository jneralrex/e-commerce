const crypto = require("crypto");

const paystackClient = require("../config/paystack.client");
const CustomError = require("../utils/errors/customErrors");

/**
 * Initialize a Paystack transaction
 */
const initializeTransaction = async ({
    email,
    amount,
    reference,
    currency = "NGN",
    callback_url,
    metadata = {},
}) => {

    if (!email || !amount || !reference) {
        throw new CustomError(
            400,
            "Email, amount and reference are required.",
            "ValidationError"
        );
    }

    try {

        const { data } = await paystackClient.post(
            "/transaction/initialize",
            {
                email,
                amount,
                reference,
                currency,
                callback_url,
                metadata,
            }
        );

        if (!data.status) {
            throw new CustomError(
                400,
                data.message || "Unable to initialize payment.",
                "PaymentError"
            );
        }

        const {
            authorization_url,
            access_code,
            reference: paystackReference,
        } = data.data;

        return {
            authorization_url,
            access_code,
            gateway_reference: paystackReference,
        };

    } catch (error) {

        if (error.code === "ECONNABORTED") {
            throw new CustomError(
                504,
                "Payment gateway timed out.",
                "GatewayTimeoutError"
            );
        }

        if (error.response) {
            throw new CustomError(
                error.response.status || 500,
                error.response.data?.message ||
                "Paystack initialization failed.",
                "PaymentGatewayError",
                error.response.data
            );
        }

        throw new CustomError(
            500,
            error.message || "Unable to reach Paystack.",
            "PaymentGatewayError"
        );
    }
};

/**
 * Verify a completed transaction
 */
const verifyTransaction = async (reference) => {
    try {

        const { data: response } = await paystackClient.get(
            `/transaction/verify/${reference}`
        );

        if (!response.status) {
            throw new CustomError(
                400,
                response.message || "Unable to verify payment.",
                "PaymentError"
            );
        }

        const transaction = response.data;

        return {
            status: transaction.status,

            provider: "paystack",

            gateway_reference:
                transaction.reference,

            // IMPORTANT:
            // Paystack returns kobo
            // Application stores naira
            amount:
                transaction.amount / 100,

            currency:
                transaction.currency,

            channel:
                transaction.channel,

            paid_at:
                transaction.paid_at,

            customer:
                transaction.customer,

            authorization:
                transaction.authorization,

            fees:
                transaction.fees
                    ? transaction.fees / 100
                    : 0,

            raw:
                transaction,
        };

    } catch (error) {

        if (error.code === "ECONNABORTED") {
            throw new CustomError(
                504,
                "Payment gateway timed out.",
                "GatewayTimeoutError"
            );
        }

        if (error.response) {
            throw new CustomError(
                error.response.status || 500,
                error.response.data?.message ||
                "Payment verification failed.",
                "PaymentGatewayError",
                error.response.data
            );
        }

        throw new CustomError(
            500,
            error.message ||
            "Unable to reach Paystack.",
            "PaymentGatewayError"
        );
    }
};


module.exports = {
    initializeTransaction,
    verifyTransaction,
};