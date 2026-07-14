import mongoose from "mongoose";
import { isValidArticleSlug, normalizeArticleSlug } from "base/utils/articleSlug";

const ArticleTagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      validate: { validator: isValidArticleSlug, message: "Invalid article tag slug" },
    },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ArticleTagSchema.index({ slug: 1 }, { unique: true });
ArticleTagSchema.index({ status: 1, name: 1 });

ArticleTagSchema.pre("validate", function () {
  this.slug = normalizeArticleSlug(this.slug || this.name);
});

export default mongoose.models.ArticleTag || mongoose.model("ArticleTag", ArticleTagSchema);

