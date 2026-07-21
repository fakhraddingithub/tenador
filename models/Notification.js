// base/models/Notification.js
import mongoose from "mongoose";

/**
 * Notification: اعلان‌های پنل مدیریت.
 *
 * هر اعلان به‌صورت side-effect در جریان‌های موجود ساخته می‌شود (سفارش، پرداخت،
 * درخواست مربیگری) و در زنگوله‌ی هدر و بَج‌های سایدبار نمایش داده می‌شود.
 *
 * انواع:
 *  - new_order           → سفارش جدید ثبت شد
 *  - new_payment         → پرداخت یک سفارش تأیید شد
 *  - coach_student_order → شاگردِ یک مربی سفارش ثبت کرده (نیاز به ثبت کردیت دستی)
 *  - coach_application   → درخواست مربیگری جدید
 */

export const NOTIFICATION_TYPES = [
  "new_order",
  "new_payment",
  "coach_student_order",
  "coach_application",
  "new_ticket",
];

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },

    // متن فارسی نمایش‌داده‌شده در لیست اعلان‌ها
    message: { type: String, required: true, trim: true },

    // ارجاع به موجودیت مرتبط — فقط موارد مربوط به هر نوع پر می‌شوند
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", default: null },
    // برای coach_application و coach_student_order: کاربری که اقدام را انجام داده
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // مسیر مقصد هنگام کلیک روی اعلان (از پیش محاسبه‌شده هنگام ساخت)
    link: { type: String, required: true },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// واکشی سریع «جدیدترین‌های خوانده‌نشده» و شمارش بَج‌ها بر اساس نوع
NotificationSchema.index({ isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, isRead: 1 });
// علامت‌گذاری «خوانده‌شده» هنگام مشاهده‌ی موجودیت مرتبط
NotificationSchema.index({ order: 1, isRead: 1 });
NotificationSchema.index({ ticket: 1, isRead: 1 });
NotificationSchema.index({ coach: 1, isRead: 1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
