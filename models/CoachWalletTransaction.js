import walletNotificationPlugin from "./walletNotificationPlugin.js";
// base/models/CoachWalletTransaction.js
import mongoose from "mongoose";

/**
 * Tracks each credit addition to a coach's wallet.
 * Created by the admin wallet route every time credit is added.
 */
const CoachWalletTransactionSchema = new mongoose.Schema(
  {
    coach:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    order:   { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    amount:  { type: Number, required: true, min: 1 },
    reversedAmount: { type: Number, default: 0, min: 0 },
    ruleCredits: [{ rule: { type: mongoose.Schema.Types.ObjectId, ref: "CoachCredit" }, amount: Number }],
    source: { type: String, enum: ["manual", "automatic"], default: "manual" },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note:    { type: String, default: "" },
  },
  { timestamps: true }
);

CoachWalletTransactionSchema.index({ coach: 1, createdAt: -1 });
CoachWalletTransactionSchema.index({ coach: 1, student: 1 });

CoachWalletTransactionSchema.plugin(walletNotificationPlugin, { source: "coach" });

export default mongoose.models.CoachWalletTransaction ||
  mongoose.model("CoachWalletTransaction", CoachWalletTransactionSchema);
