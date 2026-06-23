/**
 * models/PushSubscription.js
 *
 * اشتراکِ Web Push کاربران (Push API / VAPID).
 *
 * هر رکورد یک endpoint یکتا از مرورگر کاربر است (Chrome/Firefox/Safari iOS).
 * اشتراک‌ها ناشناس‌اند؛ اگر کاربر واردشده باشد userId هم ذخیره می‌شود.
 * وقتی سرویس پوش پاسخ 410/404 بدهد (اشتراک منقضی)، رکورد به‌صورت خودکار حذف می‌شود.
 */

import mongoose from "mongoose";

const PushSubscriptionSchema = new mongoose.Schema(
  {
    // آدرس endpoint سرویس پوش مرورگر — کلید یکتای اشتراک
    endpoint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // کلیدهای رمزنگاری برای ارسال payload رمزشده (طبق استاندارد Web Push)
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },

    // اگر کاربر واردشده بود به حسابش لینک می‌شود (اختیاری — اشتراک می‌تواند ناشناس باشد)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // برای دیباگ — مرورگر/دستگاهِ ثبت‌کننده اشتراک
    userAgent: {
      type: String,
      default: "",
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", PushSubscriptionSchema);
