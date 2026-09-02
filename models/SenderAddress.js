/**
 * models/SenderAddress.js
 *
 * آدرسِ «فرستنده» — فقط برای برگه‌ی چاپِ ارسال (لیبل آدرس).
 *
 * ⚠️ عمداً یک کالکشنِ کاملاً جدا از `Address` است و هیچ ارتباطی با آدرس‌های
 * مشتری/تحویل ندارد:
 *   • `Address` به یک `user` گره خورده و در چک‌اوت اسنپ‌شات می‌شود.
 *   • این یکی متعلق به خودِ فروشگاه است، بین همه‌ی ادمین‌ها مشترک است و هیچ‌جا
 *     روی سفارش نوشته نمی‌شود — نه در `order.address`، نه هیچ فیلد دیگری.
 *     انتخابِ فرستنده فقط یک پارامترِ URLِ صفحه‌ی چاپ است.
 * به همین دلیل هیچ روتِ عمومی‌ای این مدل را نمی‌خواند؛ فقط
 * `/api/admin/sender-addresses` (گیت‌شده با کلیدهای سفارش‌ها).
 *
 * `phone` عمداً محدود به موبایلِ ۰۹... نیست (برخلافِ آدرسِ مشتری): فرستنده
 * معمولاً یک کسب‌وکار با تلفن ثابت است. اعتبارسنجیِ مشترکِ کلاینت/سرور در
 * src/lib/senderAddressForm.mjs است.
 */

import mongoose from "mongoose";

const SenderAddressSchema = new mongoose.Schema(
  {
    // برچسبِ کوتاه برای تشخیصِ سریع در فهرست («انبار تهران»، «دفتر مرکزی»)
    title: { type: String, default: "", trim: true, maxlength: 60 },

    // نامِ شخص یا نامِ کسب‌وکارِ فرستنده
    fullName: { type: String, required: true, trim: true, maxlength: 120 },

    phone: { type: String, required: true, trim: true, maxlength: 20 },

    province: { type: String, default: "", trim: true, maxlength: 80 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    addressLine: { type: String, required: true, trim: true, maxlength: 500 },
    postalCode: { type: String, default: "", trim: true, maxlength: 20 },

    // ردپا: چه ادمینی ساختش (دفترِ ممیزی جدا از این کار می‌کند).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.SenderAddress ||
  mongoose.model("SenderAddress", SenderAddressSchema);
