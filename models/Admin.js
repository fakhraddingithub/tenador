/**
 * models/Admin.js
 *
 * «عضویت در پنل مدیریت» — نه یک هویت جداگانه.
 *
 * مدل ذهنی (فاز ۱ بازطراحی RBAC):
 *   User  = هویتِ احراز هویت + نقش کسب‌وکاری (user / coach / store / ...)
 *   Admin = عضویت یک User در پنل ادمین (یک‌به‌یک با User)
 * بنابراین یک مربی می‌تواند هم‌زمان ادمین باشد بدون از دست دادن نقش coach.
 *
 * دسترسی‌ها زنده محاسبه می‌شوند:
 *   effective = (role.permissions ∪ permissionGrants) − permissionDenials
 * و اگر نقش `isFullAccess` باشد، همه‌ی کلیدهای رجیستری (شامل کلیدهای آینده).
 *
 * فاز ۲: روت‌های ادمین بر اساس همین مدل enforce می‌شوند. تا اجرای مهاجرت،
 * کاربرانِ `User.role === "admin"` که هنوز سند Admin ندارند از مسیر legacy
 * وارد می‌شوند و همه‌ی کلیدها را دارند؛ با اجرای مهاجرت آن مسیر بسته می‌شود.
 *
 * حذف سخت پیش‌بینی نشده است: تاریخچه‌ی ممیزیِ آینده باید بعد از لغو دسترسی هم
 * باقی بماند؛ لغو دسترسی = isActive:false + revokedAt/revokedBy/revokeReason.
 */

import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema(
  {
    // ── هویت (کاربر سایت) ───────────────────────────────────────────────
    // از نظر طراحی الزامی است (عضویت بدون کاربر بی‌معناست) ولی عمداً
    // `required: true` گذاشته نشده تا:
    //   ۱) اسناد legacy با user=null قابل خواندن/ذخیره بمانند،
    //   ۲) مسیر فعلی ساخت ادمین (POST /api/admin/admins که هنوز فیلد user
    //      ندارد) در فاز ۱ نشکند.
    // امنیت به‌جای اسکیما در resolver تأمین می‌شود: سندی که user ندارد هرگز
    // به یک نشست map نمی‌شود، پس هیچ دسترسی‌ای نمی‌دهد (fail-closed).
    // اسناد بدون user توسط `npm run audit:admin-rbac` گزارش می‌شوند.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── فیلدهای نمایشی/legacy ───────────────────────────────────────────
    // پیش از این Admin یک هویت مستقل بود؛ این فیلدها تا پایان مهاجرت حفظ
    // می‌شوند (API و UI فعلی به آن‌ها تکیه دارند).
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

    // عنوان نمایشی (مثل «مدیر فروش») — مستقل از نقش
    title: {
      type: String,
      trim: true,
      default: "",
    },

    // ── دسترسی ──────────────────────────────────────────────────────────
    // نقش زنده است: تغییر دسترسی‌های نقش بلافاصله روی همه‌ی ادمین‌های آن
    // اثر می‌گذارد (هیچ snapshot ای از نقش کپی نمی‌شود).
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminRole",
      default: null,
    },

    // دسترسی‌های اضافه‌ی این ادمین، فراتر از نقش
    permissionGrants: {
      type: [String],
      default: [],
    },

    // دسترسی‌های سلب‌شده — همیشه بر نقش و grants اولویت دارد
    permissionDenials: {
      type: [String],
      default: [],
    },

    /**
     * @deprecated snapshot دسترسی‌های فاز قبل.
     *
     * در محاسبه‌ی دسترسی مؤثر استفاده نمی‌شود. مهاجرت مقدار آن را به
     * permissionGrants منتقل می‌کند: کلیدهای بازنشسته‌ی *تأییدشده* بازنویسی،
     * بازنشسته‌های بی‌معادل حذف، و کلیدهای مبهم (events.*) دست‌نخورده و
     * گزارش می‌شوند — هرگز حدس زده نمی‌شوند.
     *
     * تا وقتی فرمِ ادمین به فیلد جدید منتقل نشده، روت‌های نوشتنی هر دو فیلد را
     * هم‌زمان می‌نویسند تا UI و محاسبه‌ی دسترسی از هم جدا نیفتند.
     */
    permissions: {
      type: [String],
      default: [],
    },

    // ── وضعیت و متادیتای فعال‌سازی / لغو ────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    revokeReason: {
      type: String,
      trim: true,
      default: "",
    },

    // ── ممیزی ───────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // منشأ سند: دستی از پنل، یا ساخته‌شده توسط مهاجرت از User.role === "admin"
    source: {
      type: String,
      enum: ["panel", "migration"],
      default: "panel",
    },
  },
  // optimisticConcurrency: دو درخواستِ هم‌زمانِ ویرایش نباید متادیتای ممیزیِ
  // یکدیگر را بی‌صدا بازنویسی کنند. با فعال بودن این گزینه، `save()` روی سندی
  // که در این فاصله تغییر کرده VersionError می‌دهد و روت آن را به ۴۰۹ تبدیل
  // می‌کند — به‌جای اینکه revokedAt/revokedBy قبلی را پاک کند.
  { timestamps: true, optimisticConcurrency: true }
);

/**
 * یک‌به‌یک بودن عضویت: هر کاربر حداکثر یک سند Admin.
 * partial index تا اسناد legacy با user=null (چند تا) ایندکس یکتا را نشکنند.
 */
AdminSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
    name: "admin_user_unique",
  }
);

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
