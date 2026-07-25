// utils/payment.helper.js

const toGatewayAmount = (amount, currency) => {

    switch (currency) {

        case "NGN":
            return amount * 100;

        case "USD":
            return amount * 100;

        default:
            return amount;
    }
};

module.exports = {
    toGatewayAmount,
};