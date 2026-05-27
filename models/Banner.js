import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
  {
    position: {
      type: String,
      enum: ["wide", "tall-1", "tall-2", "strip"],
      required: true,
    },

    template: {
      type: String,
      required: true,
    },

    // ── فیلدهای متنی ──────────────────────────────────────
    title:    { type: String, default: "" },
    subtitle: { type: String, default: "" },
    badge:    { type: String, default: "" },
    ctaText:  { type: String, default: "" },
    link:     { type: String, default: "/" },

    // ── تصاویر — داینامیک با Map ───────────────────────────
    // هر slot به‌صورت key/value ذخیره میشه:
    //   images: { imageUrl: "https://...", image2Url: "https://...", ... }
    //   imagePids: { imagePublicId: "banners/xx", image2PublicId: "banners/yy", ... }
    // برای تمپلیت جدید با هر تعداد عکس، مدل نیازی به تغییر نداره
    images:    { type: Map, of: String, default: {} },
    imagePids: { type: Map, of: String, default: {} },

    // ── رنگ‌ها — Map برای انعطاف کامل ────────────────────
    // علاوه بر رنگ‌های استاندارد، تمپلیت‌ها می‌تونن
    // مقادیر اضافه مثل brightness، saturation، textPosition بذارن
    colors: { type: Map, of: String, default: {} },

    isActive: { type: Boolean, default: true },
    order:    { type: Number,  default: 0 },
  },
  { timestamps: true }
);

// ── virtual: دسترسی آسون به imageUrl مستقیم روی banner ──
// banner.imageUrl به‌جای banner.images.get("imageUrl")
BannerSchema.virtual("imageUrl").get(function () {
  return this.images?.get("imageUrl") || "";
});
BannerSchema.virtual("image2Url").get(function () {
  return this.images?.get("image2Url") || "";
});
BannerSchema.virtual("image3Url").get(function () {
  return this.images?.get("image3Url") || "";
});

// toJSON/toObject شامل virtual‌ها بشه
BannerSchema.set("toJSON",   { virtuals: true });
BannerSchema.set("toObject", { virtuals: true });

export default mongoose.models.Banner ||
  mongoose.model("Banner", BannerSchema);
