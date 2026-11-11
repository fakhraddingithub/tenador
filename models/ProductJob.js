import mongoose from "mongoose";

// Durable checkpoints, never bearer tokens or provider credentials.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requestKey: { type: String, required: true },
  inputHash: { type: String, required: true },
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["queued", "running", "needs_input", "failed", "completed"], default: "queued" },
  stage: { type: String, enum: ["prepare", "analyse", "write", "review", "revise", "commit"], default: "prepare" },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  lease: String,
  leaseUntil: { type: Date, default: () => new Date(0) },
  attempts: { type: Number, default: 0 },
  revisions: { type: Number, default: 0 },
  nextRunAt: { type: Date, default: Date.now },
  error: String,
  questions: [String],
  history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  result: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
schema.index({ userId: 1, requestKey: 1 }, { unique: true });
schema.index({ status: 1, nextRunAt: 1, leaseUntil: 1 });
export default mongoose.models.ProductJob || mongoose.model("ProductJob", schema);
