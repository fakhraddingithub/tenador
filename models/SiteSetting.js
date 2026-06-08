import mongoose from "mongoose";

/**
 * models/SiteSetting.js
 *
 * تنظیمات کلیدی-مقداری سطح سایت (key/value).
 * مثال: تصویر هدر صفحه‌ی دست‌دوم → { key: "secondhand_header_image", value: "https://..." }
 */
const SiteSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSetting ||
  mongoose.model("SiteSetting", SiteSettingSchema);
