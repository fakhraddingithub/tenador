/**
 * models/UsedProduct.js
 *
 * مدل محصول دست‌دوم — با پشتیبانی کامل از سفارش و سیستم ترکینگ
 */

import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

const HealthScoreSchema = new mongoose.Schema(
  {
    key:    { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 10 },
    note:   { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const CustomFieldSchema = new mongoose.Schema(
  {
    label:  { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 10 },
    note:   { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const UsedProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    // اسلاگ یکتا برای آدرس‌دهی صفحه محصول دست‌دوم (مثل محصولات معمولی)
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    baseProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    baseVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: false,
      default: null,
      index: true,
    },

    healthScores: {
      type: [HealthScoreSchema],
      default: [],
    },

    customFields: {
      type: [CustomFieldSchema],
      default: [],
    },

    // auto-calculated — stored for query performance
    overallScore: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },

    // قیمت به یورو (مثل محصولات معمولی — برای سازگاری با priceEngine)
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // محصول تست‌شده — نشان تأیید (تیک آبی) روی کارت و گالری نمایش داده می‌شود
    tested: {
      type: Boolean,
      default: false,
    },

    images: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["available", "reserved", "sold"],
      default: "available",
      index: true,
    },

    // سفارش مرتبط — وقتی سفارش ثبت می‌شود پر می‌شود
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    // tracking item در warehouse DB
    // مقدار string چون از DB دیگری است
    warehouseTrackingId: {
      type: String,
      default: null,
    },

    // بارکد اختصاص‌یافته در سیستم ترکینگ
    assignedBarcode: {
      type: String,
      default: null,
    },

    // ترکینگ ID (tracking code در سیستم انبار)
    assignedTrackingCode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-generate slug + calculate overallScore + validate baseVariant before save
UsedProductSchema.pre("save", async function () {
  // --- slug generation (once on creation, then kept stable) ---
  if (!this.slug) {
    const base = createSlug(this.name) || "used";
    let slug = base;
    let i = 2;
    // تضمین یکتایی اسلاگ (محصولات دست‌دوم می‌توانند نام تکراری داشته باشند)
    while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }

  // --- overallScore calculation (ratings are already out of 10) ---
  const all = [...this.healthScores, ...this.customFields];
  if (all.length === 0) {
    this.overallScore = null;
  } else {
    const avg = all.reduce((sum, s) => sum + s.rating, 0) / all.length;
    this.overallScore = Math.round(avg);
  }

  // --- Variant ownership validation ---
  if (this.baseVariant && this.isModified("baseVariant")) {
    const Variant = mongoose.model("Variant");
    const variant = await Variant.findById(this.baseVariant)
      .select("productId")  // ✅ productId نه product
      .lean();

    if (!variant) {
      throw new Error("Variant not found");
    }
    if (variant.productId.toString() !== this.baseProduct.toString()) {  // ✅
      throw new Error("baseVariant does not belong to baseProduct");
    }
  }
});

export default mongoose.models.UsedProduct ||
  mongoose.model("UsedProduct", UsedProductSchema);