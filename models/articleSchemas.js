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

