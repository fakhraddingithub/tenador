// base/models/DiscountRule.js  (نسخه جدید - جایگزین مدل قدیمی کنید)
import mongoose from "mongoose";

const DiscountRuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    /**
     * type:
     *  product       → تخفیف روی محصول خاص
     *  category      → تخفیف روی دسته‌بندی
     *  serie         → تخفیف روی سری
     *  brand         → تخفیف روی برند
     *  global        → تخفیف روی همه محصولات
     *  userRole      → تخفیف بر اساس نقش کاربر (coach, national_player, ...)
     *  userLevel     → تخفیف بر اساس سطح کاربر (silver, gold, platinum)
     *  cartValue     → تخفیف بر اساس حداقل سبد خرید
     */
    type: {
      type: String,
      enum: [
        "product",
        "category",
        "serie",
        "brand",
        "global",
        "userRole",
        "userLevel",
        "cartValue",
        "variant",
      ],
      required: true,
      index: true,
    },

    // آی‌دی محصول/دسته/سری/برند (برای تایپ‌های مرتبط)
    targets: [{ type: mongoose.Schema.Types.ObjectId, index: true }],

    // زیرفیلتر برند — فقط برای نوع category معنا دارد.
    // اگر تنظیم شود، تخفیف فقط روی محصولاتی اعمال می‌شود که هم در دسته‌ی هدف
    // و هم در یکی از این برندها باشند (مثلاً «راکت‌های ویلسون»).
    // خالی = همه‌ی برندهای آن دسته.
    targetBrands: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Brand", index: true },
    ],

    // برای userRole: مثلاً ["coach", "national_player"]
    targetRoles: {
      type: [String],
      enum: ["user", "coach", "seller", "national_player"],
      default: [],
    },

    // برای userLevel: 1=silver, 2=gold, 3=platinum
    targetLevels: { type: [Number], default: [] },

    // تعریف مقدار تخفیف
    discount: {
      kind: { type: String, enum: ["percent", "amount"], required: true },
      value: { type: Number, required: true, min: 0 },
      maxAmount: { type: Number, default: null }, // سقف تخفیف (برای نوع درصد)
    },

    // شرایط اعمال
    conditions: {
      minCartValue: { type: Number, default: 0 },
      onlyFirstOrders: { type: Boolean, default: false },
      maxUsagePerUser: { type: Number, default: null },
    },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },

    priority: { type: Number, default: 1000, index: true }, // عدد کمتر = اولویت بالاتر
    combinable: { type: Boolean, default: false }, // آیا با سایر تخفیف‌ها قابل ترکیب است
    active: { type: Boolean, default: true, index: true },

    usageLimit: { type: Number, default: null }, // حداکثر کل استفاده
    usedCount: { type: Number, default: 0 },

    source: {
      type: String,
      enum: ["platform", "vendor"],
      default: "platform",
    },

    note: { type: String, default: "" }, // توضیح داخلی ادمین
  },
  { timestamps: true }
);

DiscountRuleSchema.index({ type: 1, active: 1, startAt: 1, endAt: 1 });
DiscountRuleSchema.index({ targetRoles: 1, active: 1 });

export default mongoose.models.DiscountRule ||
  mongoose.model("DiscountRule", DiscountRuleSchema);
