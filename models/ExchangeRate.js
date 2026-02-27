import mongoose from "mongoose";

const ExchangeRateSchema = new mongoose.Schema(
  {
    // همیشه فقط یک سند فعال داریم — singleton
    currency: {
      type: String,
      default: "EUR",
      uppercase: true,
      trim: true,
    },
    // نرخ: ۱ یورو = چند تومان
    rateToToman: {
      type: Number,
      required: true,
      min: 1,
    },
    // کی آخرین بار آپدیت کرد
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// تاریخچه تغییرات نرخ
const RateHistorySchema = new mongoose.Schema(
  {
    currency:    { type: String, default: "EUR" },
    rateToToman: { type: Number, required: true },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note:        { type: String, default: "" },
  },
  { timestamps: true }
);

RateHistorySchema.index({ createdAt: -1 });

export const ExchangeRate =
  mongoose.models.ExchangeRate ||
  mongoose.model("ExchangeRate", ExchangeRateSchema);

export const RateHistory =
  mongoose.models.RateHistory ||
  mongoose.model("RateHistory", RateHistorySchema);