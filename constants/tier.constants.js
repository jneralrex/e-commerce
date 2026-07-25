const TIERS = {
  RETAILER: "retailer",
  WHOLESALER: "wholesaler",
  DISTRIBUTOR_LOCAL: "distributor_local",
  DISTRIBUTOR_INTERNATIONAL: "distributor_international",
};

const TIER_RULES = {
  retailer: {
    min_order_pcs: 100,
    self_service: true,
    price_field: "price_retailer_ngn",
    currency: "NGN",
  },

  wholesaler: {
    min_order_pcs: 600,
    self_service: true,
    price_field: "price_wholesaler_ngn",
    currency: "NGN",
  },

  distributor_local: {
    min_order_pcs: 3000,
    self_service: false,
    price_field: "price_distributor_ngn",
    currency: "NGN",
  },

  distributor_international: {
    min_order_pcs: 10000, // until SHCL confirms container pcs
    self_service: false,
    price_field: "price_international_usd",
    currency: "USD",
  },
};

module.exports = {
  TIERS,
  TIER_RULES,
};