/**
 * models/Admin.js
 *
 * حساب ادمین پنل مدیریت — جدا از مدل User تا مدیریت کاربران سایت دست‌نخورده
 * بماند. فیلد اختیاری user برای اتصال به حساب کاربری سایت (جهت ورود/enforcement
 * در فاز بعدی) پیش‌بینی شده است.
 *
 * ⚠️ در این فاز هیچ محدودیتی بر اساس این مدل اعمال نمی‌شود؛ فقط زیرساخت
 * ذخیره‌سازی ادمین‌ها و دسترسی‌هایشان است.
 */

import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    // نقش (قالب دسترسی نام‌دار) — اختیاری؛ دسترسی‌های مؤثر در فیلد permissions
    // همین سند ذخیره می‌شوند تا enforcement آینده فقط یک منبع داشته باشد
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminRole",
      default: null,
    },

    // عنوان نمایشی (مثل «مدیر فروش») — مستقل از نقش
    title: {
      type: String,
      trim: true,
      default: "",
    },

    // کلیدهای دسترسی مثل "orders.changeStatus" — از رجیستری src/lib/permissions.js
    permissions: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // اتصال اختیاری به حساب کاربری سایت — برای ورود و enforcement در فاز بعد
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
