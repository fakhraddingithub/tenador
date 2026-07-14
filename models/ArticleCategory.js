import mongoose from "mongoose";
import { MediaSchema, SeoSchema } from "base/models/articleSchemas";
import { isValidArticleSlug, normalizeArticleSlug } from "base/utils/articleSlug";

const ArticleCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      validate: { validator: isValidArticleSlug, message: "Invalid article category slug" },
    },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    seo: { type: SeoSchema, default: () => ({}) },
    cover: { type: MediaSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    order: { type: Number, default: 0, index: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "ArticleCategory", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false },
);

ArticleCategorySchema.index({ slug: 1 }, { unique: true });
ArticleCategorySchema.index({ status: 1, order: 1, name: 1 });
ArticleCategorySchema.index({ parent: 1, status: 1, order: 1 });

ArticleCategorySchema.pre("validate", function () {
  this.slug = normalizeArticleSlug(this.slug || this.name);
});

export default mongoose.models.ArticleCategory ||
  mongoose.model("ArticleCategory", ArticleCategorySchema);

