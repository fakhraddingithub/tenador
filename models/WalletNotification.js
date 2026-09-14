import mongoose from 'mongoose';

// Durable delivery receipt, retained independently of order/ledger deletion.
const schema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  trackingCode: String,
  title: String,
  message: String,
  emailSentAt: { type: Date, default: null },
  emailSkippedAt: { type: Date, default: null },
  pushSentAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lockedUntil: { type: Date, default: () => new Date(0) },
  lockToken: { type: String, default: null },
  nextAttemptAt: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ completedAt: 1, nextAttemptAt: 1, lockedUntil: 1 });
export default mongoose.models.WalletNotification || mongoose.model('WalletNotification', schema);
