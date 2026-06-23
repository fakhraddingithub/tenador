const mongoose = require("mongoose");

/**
 * PageContent — مدل انعطاف‌پذیر CMS برای تمام صفحات اطلاع‌رسانی سایت
 * (درباره ما، تماس، قوانین، سوالات متداول، بازگشت کالا، نحوه سفارش، ارسال، پرداخت).
 *
 * یک سند به ازای هر صفحه؛ کلید یکتا = pageSlug.
 *
 * sections: آرایه‌ای از بلوک‌های محتوایی. هر بلوک یک `type` دارد
 * (hero | richtext | image-text | cards | timeline | steps | faq | table |
 *  quote | payment-methods | legal | contact) و فیلدهای مخصوص همان نوع.
 * به‌صورت Mixed نگه‌داری می‌شود تا هر نوع بلوک ساختار خودش را داشته باشد و
 * افزودن نوع جدید نیاز به مهاجرت اسکیما نداشته باشد.
 */
const schema = new mongoose.Schema(
  {
    pageSlug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // برچسب فارسی صفحه برای فهرست پنل مدیریت (مثلاً «درباره ما»)
    title: {
      type: String,
      default: "",
    },
    // بلوک‌های محتوایی به ترتیب نمایش
    sections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // فیلدهای سئو (در generateMetadata استفاده می‌شوند)
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      ogImage: { type: String, default: "" },
    },
    // فعال/غیرفعال — اگر صفحه‌ای منتشر نشده باشد، محتوای پیش‌فرض سرو می‌شود
    published: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const model =
  mongoose.models.PageContent || mongoose.model("PageContent", schema);

export default model;
