import mongoose from "mongoose";

export const SeoSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 70, default: "" },
    description: { type: String, trim: true, maxlength: 320, default: "" },
    keywords: { type: [String], default: [] },
    canonicalUrl: { type: String, trim: true, default: "" },
    noIndex: { type: Boolean, default: false },
    ogTitle: { type: String, trim: true, maxlength: 95, default: "" },
    ogDescription: { type: String, trim: true, maxlength: 320, default: "" },
    ogImage: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

export const MediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, maxlength: 300, default: "" },
    width: { type: Number, min: 1, default: null },
    height: { type: Number, min: 1, default: null },
    publicId: { type: String, trim: true, default: "" },
    provider: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

// استایلِ اختیاریِ سطحِ بلوک. واژگانش بسته است و اعتبارسنجیِ اصلی در
// sanitizeArticleBlockStyle انجام می‌شود؛ enum اینجا خطِ دفاعیِ دوم است.
export const ArticleBlockStyleSchema = new mongoose.Schema(
  {
    spacing: { type: String, enum: ["none", "sm", "md", "lg"] },
    textColor: { type: String, trim: true, maxlength: 7 },
    background: { type: String, trim: true, maxlength: 7 },
    accent: { type: String, trim: true, maxlength: 7 },
    tableVariant: { type: String, enum: ["default", "striped", "bordered", "plain"] },
  },
  { _id: false, minimize: false },
);

// چیدمانِ اختیاری. "full" ذخیره نمی‌شود؛ نبودِ این کلید یعنی تمام‌عرض.
export const ArticleBlockLayoutSchema = new mongoose.Schema(
  { width: { type: String, enum: ["1/2", "1/3", "2/3"] } },
  { _id: false, minimize: false },
);

// Shared by full articles and the lightweight content section attached to a
// brand. Keeping one schema prevents the two block formats from drifting.
export const ArticleBlockSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    version: { type: Number, min: 1, default: 1 },
    // بدونِ default: بلوک‌های موجود این کلید را نمی‌گیرند و رفتارشان عوض نمی‌شود.
    style: { type: ArticleBlockStyleSchema, default: undefined },
    layout: { type: ArticleBlockLayoutSchema, default: undefined },
  },
  { _id: false, minimize: false },
);

