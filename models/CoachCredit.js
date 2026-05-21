// base/models/CoachCredit.js
import mongoose from "mongoose";

/**
 * CoachCredit: تعریف می‌کند که مربی به ازای خرید شاگرد از چه محصول/دسته/سری،
 * چقدر کردیت (به تومان یا درصد) به کیف پولش اضافه می‌شود.
 */
const CoachCreditSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // اعمال روی همه مربیان یا یک مربی خاص
    scope: {
      type: String,
      enum: ["all_coaches", "specific_coach"],
      default: "all_coaches",
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // اگر scope=specific_coach باشد پر می‌شود
    },

    // هدف کردیت: محصول خاص، دسته‌بندی، سری یا همه
    targetType: {
      type: String,
      enum: ["all", "product", "category", "serie"],
      required: true,
    },
    targets: [{ type: mongoose.Schema.Types.ObjectId }], // آی‌دی‌های هدف

    // نحوه محاسبه کردیت
    credit: {
      kind: {
        type: String,
        enum: ["percent", "amount"], // درصد از قیمت خرید یا مبلغ ثابت
        required: true,
      },
      value: { type: Number, required: true, min: 0 },
    },

    // شرایط
    conditions: {
      onlyNewStudents: { type: Boolean, default: false }, // فقط اولین خرید شاگرد
      minPurchaseAmount: { type: Number, default: 0 },
    },

    priority: { type: Number, default: 100 }, // اولویت بالاتر = اعمال شود
    active: { type: Boolean, default: true, index: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },

    // آمار
    totalCreditPaid: { type: Number, default: 0 },
    triggerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CoachCreditSchema.index({ scope: 1, active: 1, targetType: 1 });

export default mongoose.models.CoachCredit ||
  mongoose.model("CoachCredit", CoachCreditSchema);
