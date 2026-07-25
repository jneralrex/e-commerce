const mongoose = require("mongoose");

const orderLineSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true,
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Product Snapshot
        |--------------------------------------------------------------------------
        */

        product_name: {
            type: String,
            required: true,
            trim: true,
        },

        product_slug: {
            type: String,
            required: true,
            trim: true,
        },

        sku: {
            type: String,
            trim: true,
            default: null,
        },

        barcode: {
            type: String,
            trim: true,
            default: null,
        },

        brand: {
            type: String,
            trim: true,
            default: null,
        },

        model: {
            type: String,
            trim: true,
            default: null,
        },

        primary_image: {
            url: String,
            public_id: String,
        },


        /*
        |--------------------------------------------------------------------------
        | Purchased Quantity
        |--------------------------------------------------------------------------
        */

        carton_size_pcs: {
            type: Number,
            required: true,
        },

        carton_weight_kg: {
            type: Number,
            default: 0,
        },

        carton_length_cm: {
            type: Number,
            default: 0,
        },

        carton_width_cm: {
            type: Number,
            default: 0,
        },

        carton_height_cm: {
            type: Number,
            default: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Purchased Quantity
        |--------------------------------------------------------------------------
        */

        cartons: {
            type: Number,
            required: true,
            min: 1,
        },

        pcs: {
            type: Number,
            required: true,
            min: 1,
        },

        /*
        |--------------------------------------------------------------------------
        | Pricing Snapshot
        |--------------------------------------------------------------------------
        */

        unit_price: {
            type: Number,
            required: true,
            min: 0,
        },

        line_total: {
            type: Number,
            required: true,
            min: 0,
        },

        currency: {
            type: String,
            enum: ["NGN", "USD"],
            required: true,
        },

        tier_used: {
            type: String,
            enum: [
                "retailer",
                "wholesaler",
                "distributor_local",
                "distributor_international",
            ],
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

orderLineSchema.index(
    {
        order: 1,
        product: 1,
    },
    {
        unique: true,
    }
);

orderLineSchema.index({
    product: 1,
});

module.exports = mongoose.model("OrderLine", orderLineSchema);