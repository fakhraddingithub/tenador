// base/models/UserNotification.js
import mongoose from "mongoose";

/**
 * UserNotification — اعلان‌هایی که «ادمین برای کاربران ارسال می‌کند».
 *
 * ⚠️ این سیستم کاملاً جدا از models/Notification.js است:
 *   - Notification        → اعلان‌های داخلیِ خودِ پنل مدیریت (سفارش/پرداخت/مربی)
 *   - UserNotification    → پیام‌هایی که ادمین به‌صورت گروهی/تکی به کاربران می‌فرستد
 * هیچ هم‌نامی یا تداخلی بین این دو وجود ندارد.
 *
 * هدف‌گذاری (targeting):
 *   - all     → همه‌ی کاربران
 *   - role    → کاربران دارای یک نقش مشخص (targetRole)
 *   - group   → مجموعه‌ای از کاربرانِ دستی‌انتخاب‌شده (targetUserIds)
 *   - single  → یک کاربر مشخص (targetUserIds با یک عضو)
 *
 * وضعیتِ «خوانده‌شدن» در اینجا ذخیره نمی‌شود؛ به‌جای آن از یک watermark per-user
 * در UserNotificationState استفاده می‌شود (مقیاس‌پذیرتر از آرایه‌ی readUserIds یا
 * کالکشن join — توضیح در سرویس).
 */

export const USER_NOTIFICATION_TARGETS = ["all", "role", "group", "single"];

// نقش‌های معتبر برای هدف‌گذاری بر اساس نقش (هم‌ارز enum مدل User)
export const TARGETABLE_ROLES = [
  "user",
  "coach",
  "admin",
  "seller",
  "national_player",
  "store",
];

const UserNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    targetType: {
      type: String,
      enum: USER_NOTIFICATION_TARGETS,
      required: true,
      index: true,
    },

    // فقط برای targetType === "role"
    targetRole: {
      type: String,
      enum: TARGETABLE_ROLES,
      default: null,
    },

    // برای targetType === "group" یا "single"
    targetUserIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],

    // عکس فوریِ تعداد گیرنده‌ها هنگام ارسال (برای نمایش در تاریخچه‌ی ادمین)
    recipientCount: { type: Number, default: 0 },

    // ادمینی که اعلان را ارسال کرده
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// واکشی «اعلان‌های مرتبط با یک کاربر، جدیدترین اول» سریع باشد
UserNotificationSchema.index({ targetType: 1, createdAt: -1 });
UserNotificationSchema.index({ targetRole: 1, createdAt: -1 });
UserNotificationSchema.index({ targetUserIds: 1, createdAt: -1 });

export default mongoose.models.UserNotification ||
  mongoose.model("UserNotification", UserNotificationSchema);
