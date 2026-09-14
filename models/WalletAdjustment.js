import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  balanceAfter: { type: Number, required: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction", required: true },
}, { timestamps: true });
export default mongoose.models.WalletAdjustment || mongoose.model("WalletAdjustment", schema);
