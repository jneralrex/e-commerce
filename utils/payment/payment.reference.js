const crypto = require("crypto");

const generatePaymentReference = (orderId) => {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();

    return `PAY-${Date.now()}-${orderId
        .toString()
        .slice(-6)
        .toUpperCase()}-${suffix}`;
};

module.exports = generatePaymentReference;