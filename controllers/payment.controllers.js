const Order = require("../models/order.model");
const Payment = require("../models/payment.model");
const crypto = require("crypto");

const CustomError = require("../utils/errors/customErrors");

const {
  toGatewayAmount,
} = require("../utils/payment/payment.helper");

const {
  initializeTransaction,
  verifyTransaction,
  } = require("../service/paystack.service");

const {
  markPaymentAsPaid,
  markPaymentAsFailed,
  markPaymentAsRefunded,
} = require("../service/payment.service");
const { verifyWebhookSignature } = require("../utils/payment/webhook.helper");
const generatePaymentReference = require("../utils/payment/payment.reference");

const startPayment = async (req, res, next) => {
    try {

        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            throw new CustomError(
                404,
                "Order not found.",
                "NotFoundError"
            );
        }

        // Ensure the user owns the order
        if (
            order.account.toString() !==
            req.user._id.toString()
        ) {
            throw new CustomError(
                403,
                "You are not authorized to pay for this order.",
                "AuthorizationError"
            );
        }

        let payment = await Payment.findById(order.payment);

        if (!payment) {
            throw new CustomError(
                404,
                "Payment record not found.",
                "NotFoundError"
            );
        }

        switch (payment.status) {

            case "PAID":
                throw new CustomError(
                    400,
                    "This order has already been paid.",
                    "PaymentError"
                );

            case "PROCESSING":
                return res.status(200).json({
                    success: true,
                    message: "Payment already initialized.",
                    payment: {
                        authorization_url:
                            payment.authorization_url,
                        access_code:
                            payment.access_code,
                        reference:
                            payment.paystack_reference,
                    },
                });

            case "FAILED":
            case "ABANDONED":
            case "REFUNDED": {

                // Count previous attempts
                const attempts =
                    await Payment.countDocuments({
                        order: order._id,
                    });

                // Create a fresh payment attempt
                payment = await Payment.create({
                    order: order._id,
                    account: order.account,

                    amount: payment.amount,
                    currency: payment.currency,

                    payment_ref:
                        generatePaymentReference(
                            order._id
                        ),

                    status: "PENDING",

                    attempt: attempts + 1,
                });

                // Point order to the latest payment
                order.payment = payment._id;

                order.paymentStatus = "PENDING";

                order.paidAt = null;

                await order.save();

                break;
            }

            default:
                break;
        }

        // Initialize Paystack
        const gateway =
            await initializeTransaction({

                email: req.user.email,

                amount: toGatewayAmount(
                    payment.amount,
                    payment.currency
                ),

                reference:
                    payment.payment_ref,

                currency:
                    payment.currency,

                metadata: {
                    orderId:
                        order._id.toString(),

                    paymentId:
                        payment._id.toString(),

                    customerId:
                        req.user._id.toString(),

                    attempt:
                        payment.attempt,
                },
            });

        payment.gateway = gateway.provider;

        payment.authorization_url =
            gateway.authorization_url;

        payment.access_code =
            gateway.access_code;

        payment.paystack_reference =
            gateway.gateway_reference;

        payment.gateway_response =
            gateway.raw;

        payment.status = "PROCESSING";

        await payment.save();

        return res.status(200).json({
            success: true,
            message:
                "Payment initialized successfully.",
            payment: {
                authorization_url:
                    payment.authorization_url,

                access_code:
                    payment.access_code,

                reference:
                    payment.paystack_reference,

                attempt:
                    payment.attempt,
            },
        });

    } catch (error) {

        next(error);

    }
};

const verifyPayment = async (req, res, next) => {
  try {

    const { reference } = req.query;

    if (!reference) {
      throw new CustomError(
        400,
        "Payment reference is required.",
        "ValidationError"
      );
    }

    const payment = await Payment.findOne({
      payment_ref: reference,
    });

    if (!payment) {
      throw new CustomError(
        404,
        "Payment record not found.",
        "NotFoundError"
      );
    }

    // Verify with Paystack
    const gateway =
      await verifyTransaction(reference);

    // Failed payment
    if (gateway.status !== "success") {

      await markPaymentAsFailed(
        payment,
        gateway
      );

      throw new CustomError(
        400,
        "Payment was not successful.",
        "PaymentError"
      );
    }

    // Amount validation
   console.log("========== PAYMENT VALIDATION ==========");

console.log({
    gatewayAmount: gateway.amount,
    paymentAmount: payment.amount,
    gatewayCurrency: gateway.currency,
    paymentCurrency: payment.currency,
});

console.log(
    "Amount Match:",
    gateway.amount === payment.amount
);

console.log(
    "Currency Match:",
    gateway.currency === payment.currency
);

console.log("========================================");

if (
    gateway.amount !== payment.amount ||
    gateway.currency !== payment.currency
) {
    throw new CustomError(
        400,
        "Payment amount or currency mismatch.",
        "PaymentError"
    );
}

    // Marks payment + order as paid
    const {
      payment: updatedPayment,
      order: updatedOrder,
    } = await markPaymentAsPaid(
      payment,
      gateway
    );

    const completedOrder =
      await Order.findById(
        updatedOrder._id
      )
        .populate(
          "account",
          "fullname email"
        )
        .populate("payment")
        .populate("orderLines");

    return res.status(200).json({
      success: true,
      message:
        "Payment verified successfully.",
      payment: updatedPayment,
      order: completedOrder,
    });

  } catch (error) {

    next(error);

  }
};


const paystackWebhook = async (req, res, next) => {
  try {

    const signature =
      req.headers["x-paystack-signature"];

    if (!signature) {
      throw new CustomError(
        400,
        "Missing Paystack signature.",
        "ValidationError"
      );
    }

    // Verify webhook authenticity
    const isValid =
      verifyWebhookSignature(
        req.body,
        signature
      );

    if (!isValid) {
      throw new CustomError(
        401,
        "Invalid webhook signature.",
        "AuthorizationError"
      );
    }

    const event = JSON.parse(
      req.body.toString()
    );

    const supportedEvents = [
      "charge.success",
      "charge.failed",
      "transfer.success",
      "refund.processed",
      "refund.failed",
    ];

    if (!supportedEvents.includes(event.event)) {

      console.log(
        `Ignoring Paystack event: ${event.event}`
      );

      return res.status(200).json({
        success: true,
        message: "Event ignored.",
      });
    }

    if (
      !event.data ||
      !event.data.reference
    ) {
      return res.status(200).json({
        success: true,
        message: "Invalid webhook payload.",
      });
    }

    const reference =
      event.data.reference;

    console.log(
      `Paystack webhook: ${event.event} -> ${reference}`
    );

    const payment =
      await Payment.findOne({
        payment_ref: reference,
      });

    if (!payment) {

      console.log(
        `Payment not found for ${reference}`
      );

      return res.status(200).json({
        success: true,
        message:
          "Payment not found. Ignored.",
      });
    }

    switch (event.event) {

      case "charge.success": {

        if (payment.status === "PAID") {
          return res.status(200).json({
            success: true,
            message:
              "Payment already processed.",
          });
        }

        const gateway =
          await verifyTransaction(
            reference
          );

        if (
          gateway.status !==
          "success"
        ) {

          await markPaymentAsFailed(
            payment,
            gateway
          );

          return res.status(200).json({
            success: true,
            message:
              "Payment marked as failed.",
          });
        }

        if (
          gateway.amount !==
          payment.amount ||
          gateway.currency !==
          payment.currency
        ) {

          console.error(
            "Payment amount mismatch.",
            {
              gateway,
              payment,
            }
          );

          return res.status(200).json({
            success: true,
            message:
              "Amount mismatch logged.",
          });
        }

        await markPaymentAsPaid(
          payment,
          gateway
        );

        break;
      }

      case "charge.failed": {

        await markPaymentAsFailed(
          payment,
          {
            status: "failed",
            provider: "paystack",
            gateway_reference:
              event.data.reference,
            raw: event.data,
          }
        );

        break;
      }

      case "transfer.success": {

        // Future payout support
        console.log(
          `Transfer successful: ${reference}`
        );

        break;
      }

      case "refund.processed": {

        await markPaymentAsRefunded(
          payment,
          {
            status: "refunded",
            raw: event.data,
          }
        );

        break;
      }
      case "refund.failed": {

        console.error(
          `Refund failed for ${reference}`
        );

        payment.gateway_response =
          event.data;

        await payment.save();

        break;
      }

      default:
        break;
    }

    return res.status(200).json({
      success: true,
      message:
        "Webhook processed successfully.",
    });

  } catch (error) {

    next(error);

  }
};

module.exports = {
  startPayment,
  verifyPayment,
  paystackWebhook
};