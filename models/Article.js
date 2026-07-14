import mongoose from "mongoose";
import { MediaSchema, SeoSchema } from "base/models/articleSchemas";
import { calculateReadingTime } from "@/lib/articleContent";
import { isValidArticleSlug, normalizeArticleSlug } from "base/utils/articleSlug";

const ArticleBlockSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    version: { type: Number, min: 1, default: 1 },
  },
  { _id: false, minimize: false },
);

const ArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      validate: { validator: isValidArticleSlug, message: "Invalid article slug" },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ArticleCategory",
      required: true,
      index: true,
    },
    excerpt: { type: String, trim: true, maxlength: 1000, default: "" },
    cover: { type: MediaSchema, default: () => ({}) },
    blocks: { type: [ArticleBlockSchema], default: [] },
    seo: { type: SeoSchema, default: () => ({}) },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "review", "scheduled", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null, index: true },
    readingTime: { type: Number, min: 0, default: 0 },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "ArticleTag" }],
    featured: { type: Boolean, default: false, index: true },
    pinned: { type: Boolean, default: false, index: true },
    currentRevision: { type: Number, min: 1, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, minimize: false, optimisticConcurrency: true },
);

ArticleSchema.index({ category: 1, slug: 1 }, { unique: true });
ArticleSchema.index({ deletedAt: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ category: 1, deletedAt: 1, status: 1, pinned: -1, publishedAt: -1 });
ArticleSchema.index({ tags: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ featured: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ title: "text", excerpt: "text" });

ArticleSchema.pre("validate", function () {
  this.slug = normalizeArticleSlug(this.slug || this.title);
  this.tags = [...new Set((this.tags || []).map(String))];
  this.readingTime = calculateReadingTime(this.blocks);
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
  if (this.status === "scheduled" && !this.publishedAt) {
    this.invalidate("publishedAt", "publishedAt is required for scheduled articles");
  }
});

export default mongoose.models.Article || mongoose.model("Article", ArticleSchema);

