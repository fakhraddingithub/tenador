import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  trackingCode: { type: String, default: null },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
  type: { type: String, enum: ["debit", "credit"], required: true },
  amount: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  balanceBefore: { type: Number, default: null },
  balanceAfter: { type: Number, default: null },
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export default mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", schema);
