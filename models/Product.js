import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    shortDescription: { type: String, required: true },

    longDescription: { type: String, required: true },

    color: { type: String },

    score: { type: Number, default: 0 },

    basePrice: { type: Number, default: 0 },

    label: {
      type: String,
      enum: ["none", "new", "hot", "discount", "limited"],
      default: "none",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
      required: true,
    },

    tag: [String],

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    mainImage: { type: String, required: true },

    gallery: [String],

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
      required: true,
    },

    serie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Serie",
      index: true,
      default: null,
    },

    // لیمیتد ادیشن (مثل Roland Garros) — وابسته به برند؛ محصول می‌تواند
    // هم‌زمان عضو یک سری و یک لیمیتد ادیشن باشد
    limitedEdition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LimitedEdition",
      index: true,
      default: null,
    },

    athlete: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Athlete",
      },
    ],

    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      index: true,
      required: true,
    },

    attributes: {
      type: Object,
      default: {},
    },

    technicalStats: {
      type: Object,
      default: {},
    },

    customTabItems: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },

    // متادیتای سطحِ مقدارِ واریانت (Change 2/3): تصاویرِ مشترک هر مقدار و مقادیرِ چندواحدی.
    // شکل: { [attrName]: { [value]: { images: [String], units: { [unitLabel]: String } } } }
    // اختیاری و افزایشی؛ نبودنش = رفتارِ قبلی (تصاویر فقط در سطحِ واریانت).
    variantMeta: {
      type: Object,
      default: {},
    },

    slug: { type: String, unique: true, index: true },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ترتیب نمایش سراسری محصول — از صفحه‌ی «محصولات سری» در پنل ادمین
    // (درگ‌اند‌دراپ) تعیین می‌شود. محصولات جدید تا وقتی ادمین ترتیب را دستی
    // تغییر ندهد 0 می‌مانند و طبق createdAt (جدیدترین اول) مرتب می‌شوند.
    order: {
      type: Number,
      default: 0,
      index: true,
    },

    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],
  },
  { timestamps: true },
);

// ---------------------
// 🔥 Slug Generator
// ---------------------
ProductSchema.pre("save", function () {
  if (this.isModified("name") || this.isModified("modelName")) {
    this.slug = createSlug(this.name);
  }
});

// ---------------------
// 🔥 Virtual Comment
// ---------------------
ProductSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "product",
});

ProductSchema.index({ sport: 1, category: 1, brand: 1, isActive: 1 });
ProductSchema.index({ isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ sport: 1, isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ sport: 1, category: 1, isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ category: 1, order: 1, createdAt: -1 });

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
