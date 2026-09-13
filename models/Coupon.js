// models/Coupon.js
import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  createdByCoach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  coachName: { type: String, default: null },
  usedAt: { type: Date, default: null },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedByName: { type: String, default: null },
  usedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  usedTrackingCode: { type: String, default: null },
  appliedAmount: { type: Number, default: 0 },
  returnedAmount: { type: Number, default: 0 },
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
