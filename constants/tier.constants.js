const TIERS = {
  RETAILER: "retailer",
  WHOLESALER: "wholesaler",
  DISTRIBUTOR_LOCAL: "distributor_local",
  DISTRIBUTOR_INTERNATIONAL: "distributor_international",
};

const TIER_ORDER = [
  TIERS.RETAILER,
  TIERS.WHOLESALER,
  TIERS.DISTRIBUTOR_LOCAL,
  TIERS.DISTRIBUTOR_INTERNATIONAL,
];

module.exports = {
  TIERS,
  TIER_ORDER,
};