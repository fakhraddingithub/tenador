import mongoose from 'mongoose';

// Separate infrastructure collection: never modifies store business records.
const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.AssistantQuota || mongoose.model('AssistantQuota', schema);
