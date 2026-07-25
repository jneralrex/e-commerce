const Payment = require("../models/payment.model");
const Order = require("../models/order.model");

const CustomError = require("../utils/errors/customErrors");

const getOrder = async (payment) => {
    if (!payment) {
        throw new CustomError(
            404,
            "Payment not found.",
            "NotFoundError"
        );
    }

    const order = await Order.findById(payment.order);

    if (!order) {
        throw new CustomError(
            404,
            "Order not found.",
            "NotFoundError"
        );
    }

    return order;
};

const markPaymentAsPaid = async (payment, gateway) => {

    const order = await getOrder(payment);

    // Idempotency
    if (
        payment.status === "PAID" &&
        order.paymentStatus === "PAID" &&
        order.orderStatus === "PAID"
    ) {
        return {
            payment,
            order,
        };
    }

    payment.paystack_reference =
        gateway.gateway_reference ||
        payment.paystack_reference;

    payment.gateway =
        gateway.provider ||
        payment.gateway;

    payment.status = "PAID";

    payment.channel =
        gateway.channel || null;

    payment.gateway_response =
        gateway.raw || gateway;

    payment.gateway_transaction_id =
         gateway.id;

    payment.paid_amount =
        gateway.amount;

    payment.paidAt = gateway.paid_at
        ? new Date(gateway.paid_at)
        : new Date();

    await payment.save();


    // Update order after successful payment
    order.paymentStatus = "PAID";

    order.orderStatus = "PAID";

    order.paidAt = payment.paidAt;

    await order.save();


    return {
        payment,
        order,
    };
};


const markPaymentAsFailed = async (
    payment,
    gateway = null
) => {

    const order = await getOrder(payment);

    payment.status = "FAILED";

    payment.gateway_response =
        gateway?.raw || gateway || null;

    console.log("Before save:", payment.status);

    const savedPayment = await payment.save();

    console.log("After save:", savedPayment.status);

    order.paymentStatus = "FAILED";

    await order.save();

    return {
        payment: savedPayment,
        order,
    };
};

const markPaymentAsAbandoned = async (
    payment,
    gateway = null
) => {

    const order = await getOrder(payment);

    payment.status = "ABANDONED";

    payment.gateway_response =
        gateway?.raw || gateway || null;

    await payment.save();

    order.paymentStatus = "ABANDONED";

    await order.save();

    return {
        payment,
        order,
    };
};

const markPaymentAsRefunded = async (
    payment,
    gateway = null
) => {

    const order = await getOrder(payment);

    payment.status = "REFUNDED";

    payment.gateway_response =
        gateway?.raw || gateway || null;

    await payment.save();

    order.paymentStatus = "REFUNDED";

    // Business decision:
    // The order has been refunded.
    // You can later replace this with
    // "RETURNED" if your workflow supports it.
    order.orderStatus = "REFUNDED";

    await order.save();

    return {
        payment,
        order,
    };
};

module.exports = {
    markPaymentAsPaid,
    markPaymentAsFailed,
    markPaymentAsAbandoned,
    markPaymentAsRefunded,
};