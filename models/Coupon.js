// models/Coupon.js
import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  discount: {
    kind: { type: String, enum: ["percent","amount"], required: true },
    value: { type: Number, required: true }
  },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null },
  perUserLimit: { type: Number, default: 1 },
  minCartValue: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true },
  applicableTo: { type: String, enum: ["all","category","brand","product"], default: "all" },
  targets: [{ type: mongoose.Schema.Types.ObjectId }]
}, { timestamps: true });

export default mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
