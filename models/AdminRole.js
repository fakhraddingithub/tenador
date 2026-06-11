/**
 * models/AdminRole.js
 *
 * نقش ادمین — یک مجموعه دسترسی نام‌دار (مثل «مدیر محصولات» یا «پشتیبان فروش»)
 * که هنگام ساخت ادمین به‌عنوان قالب دسترسی استفاده می‌شود.
 *
 * دسترسی‌ها فقط کلیدهای رشته‌ای از رجیستری src/lib/permissions.js هستند؛
 * بنابراین افزودن دسترسی جدید هیچ تغییری در این اسکیما لازم ندارد.
 */

import mongoose from "mongoose";

const AdminRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    // کلیدهای دسترسی مثل "products.view" — اعتبارسنجی در لایه API انجام می‌شود
    permissions: {
      type: [String],
      default: [],
    },

    // نقش‌های سیستمی (مثل «دسترسی کامل») قابل حذف نیستند
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.models.AdminRole ||
  mongoose.model("AdminRole", AdminRoleSchema);
