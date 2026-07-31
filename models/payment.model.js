const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        gateway: {
            type: String,
            enum: ["paystack"],
            default: "paystack"
        },
        payment_ref: {
            type: String,
            unique: true,
            required: true
        }, 
        paystack_reference: {
            type: String,
            unique: true,
            sparse: true
        },  
        access_code: {
            type: String,
            default: null
        }, 
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            enum: ["NGN", "USD"],
            required: true
        },
        status: {
            type: String,
            enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "ABANDONED", "REFUNDED"],
            default: "PENDING"
        },
        gateway_response: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        attempt: {
            type: Number,
            default: 1,
        },
        gateway_transaction_id: {
            type: String,
        },
        authorization_url: {
            type: String,
            default: null
        }, 
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        channel: {
            type: String,
            default: null
        },
        fees: {
            type: Number,
            default: 0
        },
        paid_amount: {
            type: Number,
            default: 0
        },
        paidAt: Date
    },
    {
        timestamps: true
    }
);

paymentSchema.index({ account: 1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
