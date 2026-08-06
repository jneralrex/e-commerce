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

    const startIndex = TIER_ORDER.indexOf(baseTier);

    /**
     * NGN customers can only auto-upgrade
     * as far as Distributor Local.
     *
     * International distributors may
     * continue to Distributor International.
     */
    const highestAutomaticTier =
        baseTier === TIERS.DISTRIBUTOR_INTERNATIONAL
            ? TIERS.DISTRIBUTOR_INTERNATIONAL
            : TIERS.DISTRIBUTOR_LOCAL;

    const highestIndex =
        TIER_ORDER.indexOf(highestAutomaticTier);

    let appliedTier = baseTier;

    /**
     * Walk upward through tiers.
     */
    for (
        let i = startIndex + 1;
        i <= highestIndex;
        i++
    ) {

        const tier = TIER_ORDER[i];

        const config = pricing[tier];

      

        if (!config) {
            continue;
        }

        if (pcs >= config.moq) {

            appliedTier = tier;


        } else {

            break;

        }

    }

    /**
     * Validate MOQ of customer's own tier.
     */
    const currentConfig = pricing[baseTier];

    const valid =
        pcs >= currentConfig.moq;

    /**
     * Calculate next achievable tier.
     */
    let nextTier = getNextTier(appliedTier);

    /**
     * NGN customers should never
     * see Distributor International.
     */
    if (
        baseTier !== TIERS.DISTRIBUTOR_INTERNATIONAL &&
        nextTier === TIERS.DISTRIBUTOR_INTERNATIONAL
    ) {
        nextTier = null;
    }

    let remaining = 0;

    if (
        nextTier &&
        pricing[nextTier]
    ) {

        remaining = Math.max(
            0,
            pricing[nextTier].moq - pcs
        );

    };

    return {

        valid,

        tier: appliedTier,

        currentTier: baseTier,

        nextTier,

        nextTierRemaining: remaining,

        message:
            !valid
                ? `Minimum order for ${baseTier.replace(/_/g, " ")} is ${currentConfig.moq} pcs.`
                : appliedTier !== baseTier
                    ? `Ordering at ${appliedTier.replace(/_/g, " ")} pricing.`
                    : `Ordering at ${baseTier.replace(/_/g, " ")} pricing.`

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

    pcs = Number(pcs);

    const tierResult = resolveTier(
        user,
        product,
        pcs
    );

    const config = getTierConfig(
        product,
        tierResult.tier
    );

    const retailerPrice =
        product.pricing.retailer.unit_price;

    const savingsPerPiece =
        Math.max(
            0,
            retailerPrice - config.unit_price
        );

    const totalSavings =
        savingsPerPiece * pcs;

    let promotion = null;

    if (
        tierResult.tier !== TIERS.RETAILER
    ) {

        promotion = {

            unlocked: true,

            current_tier: tierResult.tier,

            current_price: config.unit_price,

            retailer_price: retailerPrice,

            savings_per_piece: savingsPerPiece,

            total_savings: totalSavings,

            next_tier: tierResult.nextTier,

            next_tier_price:
                tierResult.nextTier
                    ? product.pricing[tierResult.nextTier]?.unit_price
                    : null,

            next_tier_remaining:
                tierResult.nextTierRemaining,

            message:
                tierResult.nextTier
                    ? `You've unlocked ${tierResult.tier.replace(/_/g, " ")} pricing and saved ${config.currency} ${totalSavings.toLocaleString()}. Add ${tierResult.nextTierRemaining} more pcs to unlock ${tierResult.nextTier.replace(/_/g, " ")} pricing.`
                    : `You've unlocked ${tierResult.tier.replace(/_/g, " ")} pricing and saved ${config.currency} ${totalSavings.toLocaleString()} on this product.`

        };

    }

    return {

        pcs,

        cartons: Math.floor(
            pcs / product.carton_size_pcs
        ),

        loose_pcs:
            pcs % product.carton_size_pcs,

        unit_price:
            config.unit_price,

        line_total:
            config.unit_price * pcs,

        currency:
            config.currency,

        tier_used:
            tierResult.tier,

        base_tier:
            tierResult.currentTier,

        next_tier:
            tierResult.nextTier,

        next_tier_remaining:
            tierResult.nextTierRemaining,

        required_moq:
            config.moq,

        promotion

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
            $in: cart.items.map(
                item => item.product
            )
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

    for (const item of cart.items) {

        const product =
            productMap[
                item.product.toString()
            ];

        const line =
            calculateCartLine(
                user,
                product,
                item.pcs
            );

        item.pcs = line.pcs;

        totalPcs += line.pcs;

        subtotal += line.line_total;

        currencies.add(
            line.currency
        );

    }

    cart.total_pcs = totalPcs;

    cart.subtotal = subtotal;

    cart.currency =
        [...currencies][0];

    return {
        cart,
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