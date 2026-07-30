const mongoose = require("mongoose");
const slugify = require("slugify");
const TierPricingSchema = require("./tierPricing.schema");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, trim: true },
  colors: {
    type: [String],
    default: []
  },
  sizes: {
    type: [String],
    default: []
  },
  brand: { type: String, required: true, trim: true },
  carton_size_pcs: { type: Number, required: true, min: 1 },
  model: { type: String, required: true, trim: true },
  material: { type: String, required: true, trim: true },
  weight: { type: Number, required: true, min: 0 },
  carton_weight_kg: { type: Number, default: 0 },
  carton_length_cm: { type: Number, default: 0 },
  carton_width_cm: { type: Number, default: 0 },
  carton_height_cm: { type: Number, default: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  pricing: {
    type: new mongoose.Schema(
      {
        retailer: {
          type: TierPricingSchema,
          required: true,
        },
        wholesaler: {
          type: TierPricingSchema,
          required: true,
        },
        distributor_local: {
          type: TierPricingSchema,
          required: true,
        },
        distributor_international: {
          type: TierPricingSchema,
          required: true,
        },
      },
      { _id: false }
    ),
    required: true,
  },
  selling_rules: {
    allow_loose_pcs: {
      type: Boolean,
      default: true
    },
    loose_piece_surcharge: {
      type: Number,
      default: 0
    },
    minimum_loose_pcs: {
      type: Number,
      default: 1
    }
  },
  stock_pcs: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  tags: {
    type: [String],
    default: []
  },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  barcode: { type: String, trim: true, unique: true, sparse: true },
  warranty: { type: String, trim: true },
  returnPolicy: { type: String, trim: true },
  shippingLocations: [{ type: String, trim: true }],
  shippingCost: { type: Number, default: 0, min: 0 },
  images: {
    type: [
      {
        url: {
          type: String,
          required: true
        },
        public_id: {
          type: String,
          required: true
        }
      }
    ],
    validate: {
      validator: value => value.length > 0,
      message: "At least one product image is required."
    }
  },
  otherImages: [
    {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
  ],
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" },],
  active: {
    type: Boolean,
    default: true
  },

  isAvailable: {
    type: Boolean,
    default: true
  },
  allowSelfService: {
    type: Boolean,
    default: true
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// productSchema.index({ slug: 1 });
// productSchema.index({ sku: 1 });
productSchema.index({ category: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ stock_pcs: 1 });
productSchema.index({ active: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({
  name: "text",
  brand: "text",
  model: "text",
  sku: "text",
  tags: "text"
});

// Add slug generation
productSchema.pre("validate", async function () {

    if (!this.isModified("name")) {
        return;
    }

    const baseSlug = slugify(this.name, {
        lower: true,
        strict: true,
    });

    let slug = baseSlug;
    let counter = 1;

    while (
        await mongoose.models.Product.exists({
            slug,
            _id: { $ne: this._id }
        })
    ) {
        counter++;
        slug = `${baseSlug}-${counter}`;
    }

    this.slug = slug;

});


module.exports = mongoose.model("Product", productSchema);
