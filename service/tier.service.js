const { TIERS, TIER_RULES } = require("../constants/tier.constants");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");

/**
 * Resolve customer's purchasing tier.
 * Distributor accounts always use their assigned tier.
 * Retailers & wholesalers are resolved dynamically.
 */
const resolveTier = (user, totalPcs) => {

    // Fixed distributor accounts
    if (
        user.assignedTier === TIERS.DISTRIBUTOR_LOCAL ||
        user.assignedTier === TIERS.DISTRIBUTOR_INTERNATIONAL
    ) {
        return user.assignedTier;
    }

    // Wholesaler pricing
    if (totalPcs >= TIER_RULES.wholesaler.min_order_pcs) {
        return TIERS.WHOLESALER;
    }

    // Everyone else uses retailer pricing
    return TIERS.RETAILER;
};

/**
 * Returns the correct price based on customer's tier.
 */
const getApplicablePrice = (product, tier) => {
    switch (tier) {
        case TIERS.RETAILER:
            return product.price_retailer_ngn;

        case TIERS.WHOLESALER:
            return product.price_wholesaler_ngn;

        case TIERS.DISTRIBUTOR_LOCAL:
            return product.price_distributor_ngn;

        case TIERS.DISTRIBUTOR_INTERNATIONAL:
            return product.price_international_usd;

        default:
            return null;
    }
};

/**
 * Calculates a single cart line.
 */
const calculateCartLine = (product, cartons, tier) => {
    if (!product.carton_size_pcs) {
        throw new CustomError(
            400,
            `${product.name} has no carton size configured.`,
            "ValidationError"
        );
    }

    const unitPrice = getApplicablePrice(product, tier);

    if (unitPrice == null) {
        throw new CustomError(
            400,
            `No price configured for tier "${tier}".`,
            "ValidationError"
        );
    }

    const pcs = cartons * product.carton_size_pcs;

    return {
        product,
        cartons,
        pcs,
        unit_price: unitPrice,
        line_total: pcs * unitPrice,
    };
};

/**
 * Validate Minimum Order Quantity.
 */
const validateMOQ = (tier, totalPcs) => {

    const rule = TIER_RULES[tier];

    if (!rule) {
        return {
            valid: false,
            remaining: 0,
            message: "Invalid tier.",
        };
    }

    const remaining = Math.max(
        0,
        rule.min_order_pcs - totalPcs
    );

    return {
        valid: remaining === 0,
        remaining,
        message:
            remaining === 0
                ? "MOQ satisfied."
                : `You need ${remaining} more pcs to reach the minimum order quantity.`,
    };
};
/**
 * Resolve order currency.
 */
const getCurrency = (tier) => {
    return tier === TIERS.DISTRIBUTOR_INTERNATIONAL ? "USD" : "NGN";
};

/**
 * Calculate cart totals.
 */
const calculateCartTotals = (items) => {
    return {
        totalPcs: items.reduce((sum, item) => sum + item.pcs, 0),
        totalCartons: items.reduce((sum, item) => sum + item.cartons, 0),
        subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
    };
};

/**
 * Recalculate the entire cart whenever an item changes.
 */
const recalculateCart = async (cart, user) => {
    const products = await Product.find({
        _id: {
            $in: cart.items.map((item) => item.product),
        },
    });

    const productMap = {};

    products.forEach((product) => {
        productMap[product._id.toString()] = product;
    });

    let totalPcs = 0;

    // First Pass
    cart.items.forEach((item) => {
        const product = productMap[item.product.toString()];

        if (!product) {
            throw new CustomError(
                404,
                "One or more products in the cart no longer exist.",
                "NotFoundError"
            );
        }

        if (!product.carton_size_pcs) {
            throw new CustomError(
                400,
                `${product.name} has no carton size configured.`,
                "ValidationError"
            );
        }

        if (item.cartons < 1) {
            throw new CustomError(
                400,
                "Cartons must be at least 1.",
                "ValidationError"
            );
        }

        item.pcs = item.cartons * product.carton_size_pcs;

        totalPcs += item.pcs;
    });

    const tier = resolveTier(user, totalPcs);

    cart.items.forEach((item) => {
        const product = productMap[item.product.toString()];

        const unitPrice = getApplicablePrice(product, tier);

        if (unitPrice == null) {
            throw new CustomError(
                400,
                `No price configured for tier "${tier}".`,
                "ValidationError"
            );
        }

        item.unit_price = unitPrice;
        item.line_total = unitPrice * item.pcs;
    });

    const totals = calculateCartTotals(cart.items);

    cart.total_cartons = totals.totalCartons;
    cart.total_pcs = totals.totalPcs;
    cart.subtotal = totals.subtotal;
    cart.resolvedTier = tier;
    cart.currency = getCurrency(tier);

    return {
        cart,
        productMap,
    };
};

module.exports = {
    resolveTier,
    getApplicablePrice,
    calculateCartLine,
    calculateCartTotals,
    validateMOQ,
    getCurrency,
    recalculateCart,
};