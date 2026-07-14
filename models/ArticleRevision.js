import mongoose from "mongoose";

const ArticleRevisionSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: "Article", required: true },
    revision: { type: Number, required: true, min: 1 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    schemaVersion: { type: Number, min: 1, default: 1 },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, minimize: false },
);

ArticleRevisionSchema.index({ article: 1, revision: -1 }, { unique: true });
ArticleRevisionSchema.index({ article: 1, createdAt: -1 });

export default mongoose.models.ArticleRevision ||
  mongoose.model("ArticleRevision", ArticleRevisionSchema);

