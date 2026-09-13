import mongoose from "mongoose";

// Permanent idempotency receipt. The default _id index protects retries even
// before optional indexes are installed, and survives physical order deletion.
const schema = new mongoose.Schema({
  _id: String,
  requestHash: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  trackingCode: String,
  totalPrice: Number,
  walletPaid: Number,
}, { timestamps: true });
export default mongoose.models.WalletCheckout || mongoose.model("WalletCheckout", schema);
