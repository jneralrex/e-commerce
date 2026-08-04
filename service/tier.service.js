const { TIERS, TIER_ORDER } = require("../constants/tier.constants");
const Product = require("../models/product.model");
const CustomError = require("../utils/errors/customErrors");



const getBaseTier = (user) => {

    if (
        user.assignedTier &&
        TIER_ORDER.includes(user.assignedTier)
    ) {
        return user.assignedTier;
    }

    return TIERS.RETAILER;

};


const getNextTier = (tier) => {

    const index = TIER_ORDER.indexOf(tier);

    if (index === -1) return null;

    return TIER_ORDER[index + 1] ?? null;

};

/**
 * Resolve customer's purchasing tier.
 * Distributor accounts always use their assigned tier.
 * Retailer/Wholesaler are resolved PER PRODUCT.
 */
const resolveTier = (user, product, pcs) => {

    const pricing = product.pricing;

    if (!pricing) {

        throw new CustomError(
            400,
            `${product.name} has no pricing configured.`,
            "ValidationError"
        );

    }

    const baseTier = getBaseTier(user);

    let appliedTier = baseTier;

    const startIndex = TIER_ORDER.indexOf(baseTier);

    /**
     * Walk UP the ladder.
     */

    for (let i = startIndex + 1; i < TIER_ORDER.length; i++) {

        const tier = TIER_ORDER[i];

        const config = pricing[tier];

        if (!config) continue;

        if (pcs >= config.moq) {

            appliedTier = tier;

        } else {

            break;

        }

    }

    /**
     * Validate minimum order of CURRENT tier.
     */

    const currentConfig = pricing[baseTier];

    const valid = pcs >= currentConfig.moq;

    const nextTier = getNextTier(appliedTier);

    let remaining = 0;

    if (nextTier && pricing[nextTier]) {

        remaining = Math.max(
            0,
            pricing[nextTier].moq - pcs
        );

    }

    return {

        valid,

        tier: appliedTier,

        currentTier: baseTier,

        nextTier,

        nextTierRemaining: remaining,

        message:
            !valid
                ? `Minimum order for ${baseTier.replace("_", " ")} is ${currentConfig.moq} pcs.`
                : appliedTier !== baseTier
                    ? `Ordering at ${appliedTier.replace("_", " ")} pricing.`
                    : `Ordering at ${baseTier.replace("_", " ")} pricing.`

    };

};


const resolveVisiblePrice = (product, user) => {

    const tier =
        user?.assignedTier && TIER_ORDER.includes(user.assignedTier)
            ? user.assignedTier
            : TIERS.RETAILER;

    const config = getTierConfig(product, tier);

    return {
        currency: config.currency,
        price: config.unit_price,
        tier
    };
};

/**
 * Returns applicable pricing object.
 */
const getTierConfig = (product, tier) => {

    if (!tier) {
        throw new CustomError(
            400,
            "Pricing tier is required.",
            "ValidationError"
        );
    }

    const config = product?.pricing?.[tier];

    if (!config) {
        throw new CustomError(
            400,
            `Pricing for tier "${tier}" is not configured.`,
            "ValidationError"
        );
    }

    return config;

};

/**
 * Unit price.
 */

const getApplicablePrice = (product, tier) => {

    return getTierConfig(product, tier).unit_price;

};



/**
 * Currency.
 */
const getCurrency = (product, tier) => {

    return getTierConfig(product, tier).currency;

};

/**
 * Whether this tier supports self-service.
 */

const isSelfService = (product, tier) => {

    return getTierConfig(product, tier).self_service;

};


/**
 * Calculate one cart line.
 */
const calculateCartLine = (user, product, pcs) => {

    if (!product.carton_size_pcs) {
        throw new CustomError(
            400,
            `${product.name} has no carton size configured.`
        );
    }

    pcs = Number(pcs);

    if (!Number.isFinite(pcs) || pcs < 1) {
        throw new CustomError(
            400,
            "Quantity must be at least 1 piece."
        );
    }

    const cartons = Math.floor(
        pcs / product.carton_size_pcs
    );

    const loose_pcs =
        pcs % product.carton_size_pcs;

    const tierResult = resolveTier(
        user,
        product,
        pcs
    );

    if (!tierResult.valid) {
        throw new CustomError(
            400,
            tierResult.message
        );
    }

    const config = getTierConfig(product, tierResult.tier);

    return {

        pcs,

        cartons,

        loose_pcs,

        unit_price: getApplicablePrice(product, tierResult.tier),

        currency: getCurrency(product, tierResult.tier),

        self_service: isSelfService(product, tierResult.tier),

        line_total:
            getApplicablePrice(product, tierResult.tier) * pcs,

        currency: config.currency,

        tier_used: tierResult.tier,

        base_tier: tierResult.currentTier,

        next_tier: tierResult.nextTier,

        next_tier_remaining:
            tierResult.nextTierRemaining,

        required_moq: config.moq

    };

};

/**
 * Cart totals.
 */
const calculateCartTotals = (items) => ({

    totalPcs: items.reduce(
        (sum, item) => sum + item.pcs,
        0
    ),


    subtotal: items.reduce(
        (sum, item) => sum + item.line_total,
        0
    ),

});

/**
 * Recalculate entire cart.
 *
 * NOTE:
 * Every product now resolves its own tier.
 */
const recalculateCart = async (cart, user) => {

    const products = await Product.find({
        _id: {
            $in: cart.items.map(item => item.product)
        }
    });

    const productMap = Object.fromEntries(
        products.map(product => [
            product._id.toString(),
            product
        ])
    );

    let totalPcs = 0;
    let subtotal = 0;

    const currencies = new Set();

    const calculatedItems = [];

    for (const item of cart.items) {

        const product = productMap[item.product.toString()];

        if (!product) {
            throw new CustomError(
                404,
                "One or more products no longer exist.",
                "NotFoundError"
            );
        }

        const line = calculateCartLine(
            user,
            product,
            item.pcs
        );

        // Persist only schema fields
        item.pcs = line.pcs;

        totalPcs += line.pcs;
        subtotal += line.line_total;

        currencies.add(line.currency);

        calculatedItems.push({
            product,
            pcs: line.pcs,
            cartons: line.cartons,
            loose_pcs: line.loose_pcs,

            unit_price: line.unit_price,
            line_total: line.line_total,
            currency: line.currency,

            tier_used: line.tier_used,
            base_tier: line.base_tier,

            required_moq: line.required_moq,

            next_tier: line.next_tier,
            next_tier_remaining: line.next_tier_remaining,

            message: line.message
        });

    }

    cart.total_pcs = totalPcs;
    cart.subtotal = subtotal;

    cart.currency =
        currencies.size === 1
            ? [...currencies][0]
            : [...currencies];

    return {
        cart,
        items: calculatedItems,
        productMap
    };

};



module.exports = {

    resolveTier,

    getTierConfig,

    getApplicablePrice,

    getCurrency,

    isSelfService,

    resolveVisiblePrice,

    calculateCartLine,

    calculateCartTotals,

    recalculateCart

};