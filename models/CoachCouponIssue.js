import mongoose from "mongoose";

// Permanent retry receipt; claimed before debiting the shared wallet.
const schema = new mongoose.Schema({
  _id: String,
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  code: { type: String, required: true },
  amount: { type: Number, required: true },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
}, { timestamps: true });
export default mongoose.models.CoachCouponIssue || mongoose.model("CoachCouponIssue", schema);
