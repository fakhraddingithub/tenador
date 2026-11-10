import mongoose from "mongoose";

// Opaque OAuth credentials and short-lived product preparation records. Never store raw tokens.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  kind: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.McpGrant || mongoose.model("McpGrant", schema);
