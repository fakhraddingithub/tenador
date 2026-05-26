import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
  {
    // نوع موقعیت در گرید
    position: {
      type: String,
      enum: ["wide", "tall-1", "tall-2", "strip"],
      required: true,
    },
    // تمپلیت انتخاب‌شده
    template: {
      type: String,
      required: true,
    },
    // محتوا
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    badge: { type: String, default: "" }, // مثلاً "تخفیف ویژه"
    ctaText: { type: String, default: "" }, // متن دکمه
    link: { type: String, default: "/" },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    // رنگ‌های قابل سفارشی‌سازی
    colors: {
      primary: { type: String, default: "#aa4725" },
      secondary: { type: String, default: "#ffbf00" },
      accent: { type: String, default: "#ffffff" },
      bg: { type: String, default: "#0d0d0d" },
      text: { type: String, default: "#ffffff" },
      textSecondary: { type: String, default: "rgba(255,255,255,0.7)" },
    },

    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Banner ||
  mongoose.model("Banner", BannerSchema);
