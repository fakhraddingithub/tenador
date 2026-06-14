// base/models/QuantityDiscount.js
//
// تخفیف تعدادی (پلکانی) — قابل اعمال روی محصول خاص، برند، سری، دسته‌بندی یا همه‌ی محصولات.
// در بخش «تخفیف‌ها»ی پنل ادمین مدیریت می‌شود و در priceEngine روی قیمت واحدِ نهایی اعمال می‌گردد.
//
// هر سند چند پله (tier) دارد:
//   مثال: ۲ عدد به بالا → ۱۰٪ ، ۳ عدد به بالا → ۱۵٪
// بهترین پله‌ای که تعداد سبد به آن رسیده باشد اعمال می‌شود.

import mongoose from "mongoose";

const TierSchema = new mongoose.Schema(
  {
    // حداقل تعداد برای فعال شدن این پله
    minQty: { type: Number, required: true, min: 2 },

    discount: {
      // percent: درصد از قیمت واحد | amount: مبلغ ثابت به تومان از قیمت واحد
      kind: { type: String, enum: ["percent", "amount"], required: true },
      value: { type: Number, required: true, min: 0 },
    },
  },
  { _id: false }
);

const QuantityDiscountSchema = new mongoose.Schema(
  {
    // نوع هدف: همه محصولات / محصول خاص / برند / سری / دسته‌بندی
    type: {
      type: String,
      enum: ["global", "product", "brand", "serie", "category"],
      required: true,
      index: true,
    },

    // آی‌دی‌های هدف (برای نوع‌های غیر global)
    targets: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      default: [],
    },

    title: { type: String, default: "", trim: true },

    tiers: {
      type: [TierSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "حداقل یک پله تخفیف لازم است",
      },
    },

    active: { type: Boolean, default: true, index: true },

    // بازه زمانی اختیاری — null یعنی بدون محدودیت
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
  },
  { timestamps: true }
);

QuantityDiscountSchema.index({ active: 1, startAt: 1, endAt: 1 });

export default mongoose.models.QuantityDiscount ||
  mongoose.model("QuantityDiscount", QuantityDiscountSchema);
