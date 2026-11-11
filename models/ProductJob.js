import mongoose from "mongoose";

// One Codex product-authoring request: its idempotency key, the reserved product id, the
// preparation handed to the agents, imported images and, once saved, the result with the
// review evidence. Never bearer tokens or provider credentials.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requestKey: { type: String, required: true },
  inputHash: { type: String, required: true },
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  // queued/running/needs_input/failed only exist on jobs from the retired server worker;
  // resume_product_job moves them to awaiting_chat.
  status: { type: String, enum: ["awaiting_chat", "completed", "queued", "running", "needs_input", "failed"], default: "awaiting_chat" },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
schema.index({ userId: 1, requestKey: 1 }, { unique: true });
export default mongoose.models.ProductJob || mongoose.model("ProductJob", schema);
