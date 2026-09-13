import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  trackingCode: { type: String, required: true },
  type: { type: String, enum: ["debit", "credit"], required: true },
  amount: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export default mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", schema);
