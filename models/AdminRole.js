/**
 * models/AdminRole.js
 *
 * نقش ادمین — یک مجموعه دسترسی نام‌دار (مثل «مدیر محصولات» یا «پشتیبان فروش»).
 *
 * نقش «زنده» است: ادمین‌ها فقط به نقش ارجاع می‌دهند و هیچ کپی‌ای از
 * دسترسی‌های نقش روی سند ادمین ذخیره نمی‌شود؛ پس ویرایش نقش بلافاصله روی
 * همه‌ی ادمین‌های آن اثر می‌گذارد.
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

    // نقش‌های سیستمی قابل حذف نیستند
    isSystem: {
      type: Boolean,
      default: false,
    },

    /**
     * شناسه‌ی داخلی و پایدارِ نقش سیستمی (مثل "super-admin").
     *
     * هویتِ نقشِ محافظت‌شده هرگز از روی `name` تشخیص داده نمی‌شود: نام نمایشی
     * قابل تغییر و قابل جعل است، و هر کاربری می‌تواند نقشی با همان نام بسازد.
     * تنها این کلید (و پرچم‌های isSystem/isFullAccess) معیارند.
     */
    systemKey: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * نقش «دسترسی کامل».
     *
     * عمداً به‌جای ذخیره‌ی یک کلید wildcard در permissions:
     *   ۱) کلیدهایی که در آینده به رجیستری اضافه می‌شوند خودکار پوشش می‌یابند،
     *   ۲) هیچ کلید «همه‌چیز» ذخیره‌شدنی وجود ندارد که کسی بتواند از طریق
     *      API نقش‌ها برای خودش ست کند (sanitizePermissions آن را نمی‌شناسد).
     *
     * فقط مهاجرت/اسکریپت سیستمی این پرچم را ست می‌کند.
     */
    isFullAccess: {
      type: Boolean,
      default: false,
    },

    /**
     * شمارنده‌ی داخلیِ ناوردا — فقط برای سریال‌سازیِ تراکنش‌ها.
     *
     * عملیات‌هایی که می‌توانند «آخرین سوپرادمین» را از بین ببرند، داخل تراکنش
     * روی همین فیلد `$inc` می‌زنند. چون همه به یک سند می‌نویسند، دو تراکنشِ
     * هم‌زمان WriteConflict می‌گیرند و سریال می‌شوند؛ بدون این، MongoDB فقط
     * snapshot isolation می‌دهد و write-skew رخ می‌دهد.
     *
     * ⚠️ حتماً باید در schema تعریف شده باشد: با `strict: true` (پیش‌فرض
     * Mongoose) هر فیلدِ تعریف‌نشده‌ای از update حذف می‌شود و sentinel عملاً
     * هیچ نوشتنی انجام نمی‌داد.
     *
     * select:false تا در کوئری‌های عادی ظاهر نشود.
     */
    invariantRevision: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  { timestamps: true }
);

/**
 * هر systemKey حداکثر یک نقش. partial index تا نقش‌های عادی (systemKey=null)
 * ایندکس یکتا را نشکنند.
 */
AdminRoleSchema.index(
  { systemKey: 1 },
  {
    unique: true,
    partialFilterExpression: { systemKey: { $type: "string" } },
    name: "adminrole_systemkey_unique",
  }
);

export default mongoose.models.AdminRole ||
  mongoose.model("AdminRole", AdminRoleSchema);
