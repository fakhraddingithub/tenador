import mongoose from "mongoose";

// What one Codex product job hands its agents, and what binds their result: the source, the
// rules hash, the imported images and the recorded review. Kept apart from McpGrant (OAuth
// credentials) so revoking or wiping tokens can never touch work in progress, and vice versa.
// Short-lived by design: expiresAt slides on use and the TTL index removes the rest.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.ProductPreparation || mongoose.model("ProductPreparation", schema);
