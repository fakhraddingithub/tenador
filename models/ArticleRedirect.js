import mongoose from "mongoose";
import { isValidArticleSlug, normalizeArticleSlug } from "base/utils/articleSlug";

const ArticleRedirectSchema = new mongoose.Schema(
  {
    fromCategorySlug: { type: String, required: true, trim: true, lowercase: true },
    fromArticleSlug: { type: String, required: true, trim: true, lowercase: true },
    article: { type: mongoose.Schema.Types.ObjectId, ref: "Article", required: true, index: true },
    statusCode: { type: Number, enum: [301, 308], default: 308 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ArticleRedirectSchema.index(
  { fromCategorySlug: 1, fromArticleSlug: 1 },
  { unique: true },
);
ArticleRedirectSchema.index({ active: 1, fromCategorySlug: 1, fromArticleSlug: 1 });

ArticleRedirectSchema.pre("validate", function () {
  this.fromCategorySlug = normalizeArticleSlug(this.fromCategorySlug);
  this.fromArticleSlug = normalizeArticleSlug(this.fromArticleSlug);
  if (!isValidArticleSlug(this.fromCategorySlug) || !isValidArticleSlug(this.fromArticleSlug)) {
    this.invalidate("fromArticleSlug", "Invalid article redirect path");
  }
});

export default mongoose.models.ArticleRedirect ||
  mongoose.model("ArticleRedirect", ArticleRedirectSchema);
