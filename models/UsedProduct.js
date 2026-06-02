/**
 * models/UsedProduct.js
 *
 * مدل محصول دست‌دوم — با پشتیبانی کامل از سفارش و سیستم ترکینگ
 */

import mongoose from "mongoose";

const HealthScoreSchema = new mongoose.Schema(
  {
    key:    { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    note:   { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const CustomFieldSchema = new mongoose.Schema(
  {
    label:  { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
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

    baseProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
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

// Auto-calculate overallScore before save
UsedProductSchema.pre("save", function () {
  const all = [...this.healthScores, ...this.customFields];
  if (all.length === 0) {
    this.overallScore = null;
    return;
  }
  const avg = all.reduce((sum, s) => sum + s.rating, 0) / all.length;
  // convert 1-5 scale → 1-10
  this.overallScore = Math.round(((avg - 1) / 4) * 9 + 1);
});

export default mongoose.models.UsedProduct ||
  mongoose.model("UsedProduct", UsedProductSchema);