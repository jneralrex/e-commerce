const mongoose = require("mongoose");
const slugify = require("slugify");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, trim: true },
  colors: [{ type: String, required: true, trim: true }],
  sizes: [{ type: String, required: true, trim: true }],
  brand: { type: String, required: true, trim: true },
  moq: { type: Number, required: true, min: 1 },
  model: { type: String, required: true, trim: true },
  material: { type: String, required: true, trim: true },
  weight: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  stock: { type: Number, required: true, min: 0 },
  tags: [{ type: String, trim: true }],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sku: { type: String, required: true, unique: true, trim: true },
  barcode: { type: String, unique: true, trim: true },
  warranty: { type: String, trim: true },
  returnPolicy: { type: String, trim: true },
  shippingLocations: [{ type: String, trim: true }],
  shippingCost: { type: Number, default: 0, min: 0 },
  images: [
    {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    }
  ],
  otherImages: [
    {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    }
  ],
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
  isAvailable: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add slug generation
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Virtual discounted price
productSchema.virtual("discountedPrice").get(function () {
  return this.price - (this.price * this.discount) / 100;
});

module.exports = mongoose.model("Product", productSchema);
