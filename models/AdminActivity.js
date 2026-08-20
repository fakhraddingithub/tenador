/**
 * models/AdminActivity.js
 *
 * دفترِ فعالیتِ ادمین‌ها — فقط‌افزودنی (append-only).
 *
 * چرا یک مدلِ جدا و نه لاگِ سرور: باید از داخلِ پنل قابل جست‌وجو، فیلتر و
 * صفحه‌بندی باشد و بعد از لغو دسترسیِ ادمین هم بماند.
 *
 * ── قواعدِ تغییرناپذیری ──────────────────────────────────────────────────
 * «فقط‌افزودنی» اینجا با سه لایه تأمین می‌شود، نه با آرزو:
 *   ۱) هیچ روتِ APIای متدِ نوشتنی روی این کالکشن ندارد (فقط GET).
 *   ۲) اسکیما `strict: "throw"` است و هوکِ pre('save') هرگونه ذخیره‌ی
 *      دوباره‌ی یک سندِ موجود را رد می‌کند.
 *   ۳) هوک‌های pre روی همه‌ی متدهای update/delete خطا می‌دهند، پس حتی کدِ
 *      داخلی هم نمی‌تواند سهواً رکورد را دستکاری کند.
 * دسترسیِ مستقیم به دیتابیس طبعاً خارج از کنترلِ اپلیکیشن است؛ این ادعا
 * فقط درباره‌ی مسیرهای درون‌برنامه‌ای است.
 *
 * ── نگهداری ─────────────────────────────────────────────────────────────
 * `expiresAt` اختیاری است و پیش‌فرض ندارد: تا وقتی سیاستِ نگهداری تصویب
 * نشده، هیچ رکوردی خودکار حذف نمی‌شود. ایندکسِ TTL آماده است تا با پر کردنِ
 * این فیلد (یا یک migration) فعال شود.
 */

import mongoose from "mongoose";

/**
 * نتیجه‌ی یک اقدام.
 *
 *   success   — عملیات انجام شد (فقط روت‌های صریحاً ممیزی‌شده)
 *   failure   — عملیات شروع شد و شکست خورد
 *   denied    — گیت اجازه نداد (۴۰۱/۴۰۳)
 *   attempted — گیت اجازه داد، ولی نتیجه‌ی خودِ عملیات ثبت نشده است. این
 *               رکوردها را گیتِ مرکزی خودکار برای هر کلیدِ نوشتنی می‌سازد،
 *               بدون آنکه هندلر کاری کند.
 */
export const ACTIVITY_RESULTS = ["success", "failure", "denied", "attempted"];

const AdminActivitySchema = new mongoose.Schema(
  {
    /* ── بازیگر ────────────────────────────────────────────────────────
       هم کاربر و هم عضویت نگه داشته می‌شوند: عضویت ممکن است بعداً لغو شود
       ولی رکورد باید همچنان بگوید «چه کسی». */
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    actorAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", index: true, default: null },

    /** عکسِ لحظه‌ای از هویت و دسترسیِ بازیگر — نقش‌ها بعداً عوض می‌شوند. */
    actorSnapshot: {
      name: { type: String, default: "" },
      username: { type: String, default: "" },
      roleName: { type: String, default: "" },
      roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminRole", default: null },
      isFullAccess: { type: Boolean, default: false },
      /** مسیرِ مجوز: membership | legacy-user-role | none */
      source: { type: String, default: "none" },
      /** تعدادِ کلیدهای مؤثر — خودِ فهرست عمداً ذخیره نمی‌شود (حجیم و پرنویز). */
      permissionCount: { type: Number, default: 0 },
    },

    /* ── اقدام ────────────────────────────────────────────────────────── */
    /** شناسه‌ی ماشین‌خوان، مثل `order.status.change` یا `authz.denied`. */
    action: { type: String, required: true, index: true },
    /** کلید(های) دسترسیِ لازم برای این اقدام. */
    permissions: { type: [String], default: [] },
    method: { type: String, default: "" },
    /** روتِ نرمال‌شده (با [param])، نه URLِ حاوی شناسه. */
    route: { type: String, default: "" },

    /* ── منبع ─────────────────────────────────────────────────────────── */
    resourceType: { type: String, default: "" },
    resourceId: { type: String, default: "" },
    /** برچسبِ خواناندنیِ منبع در زمانِ اقدام (نامِ محصول، کدِ سفارش، …). */
    resourceLabel: { type: String, default: "" },

    /**
     * جمله‌ی فارسیِ «دقیقاً چه اتفاقی افتاد» — در زمانِ اقدام ساخته و
     * *ذخیره* می‌شود، نه هنگام نمایش.
     *
     * چرا ذخیره و نه محاسبه در UI: اگر سفارش یا محصول بعداً حذف شود، رکورد
     * باید همچنان بگوید «حذف محصول «Wilson Blade 100»». محاسبه‌ی هنگامِ
     * نمایش به موجودیتی نیاز دارد که دیگر وجود ندارد.
     *
     * رکوردهای قبل از این فیلد خالی‌اند و UI به برچسبِ اقدام برمی‌گردد؛
     * هیچ رکوردِ قدیمی‌ای بی‌معنا یا ناخوانا نمی‌شود.
     */
    description: { type: String, default: "" },

    /**
     * موجودیت‌های دیگری که همین اقدام عوض کرد.
     *
     * یک اقدامِ ادمین معمولاً چند نوشتن است (تأییدِ پرداخت → هم Payment و هم
     * Order). به‌جای سه ردیفِ جدا در خطِ زمانی، یک ردیف با موضوعِ اصلی و
     * فهرستِ مرتبط‌ها ثبت می‌شود.
     *
     * شکل: { type, key, id, label, op, action, description, changes }
     */
    related: { type: [mongoose.Schema.Types.Mixed], default: [] },

    /* ── نتیجه ────────────────────────────────────────────────────────── */
    result: { type: String, enum: ACTIVITY_RESULTS, required: true, index: true },
    /** ۲۰۰/۴۰۳/۵۰۰ … برای رد شدن سریع روی خطاها. */
    statusCode: { type: Number, default: 0 },
    /** دسته‌ی خطا/رد — نه متنِ خام. مثل `missing-permission`. */
    reason: { type: String, default: "" },

    /* ── زمینه‌ی درخواست ──────────────────────────────────────────────── */
    requestId: { type: String, default: "", index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    /* ── جزئیات ──────────────────────────────────────────────────────────
       هر دو از فیلترِ حذفِ اسرار عبور کرده‌اند (src/lib/adminActivity.js).
       Mixed است چون شکلشان به اقدام بستگی دارد. */
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    /** تفاوتِ قبل/بعد به شکل { field: { from, to } } — فقط برای mutation. */
    changes: { type: mongoose.Schema.Types.Mixed, default: null },

    /** برای سیاستِ نگهداریِ آینده؛ تا تعیین‌نشدن، خالی می‌ماند. */
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // فیلدِ ناشناخته باید خطا بدهد، نه اینکه بی‌صدا حذف شود: رکوردِ ممیزیِ
    // ناقصِ بی‌سروصدا بدتر از خطاست.
    strict: "throw",
    minimize: false,
  }
);

/* ── ایندکس‌ها: پرس‌وجوهای واقعیِ خطِ زمانی ───────────────────────────── */
AdminActivitySchema.index({ actorUser: 1, createdAt: -1 });
AdminActivitySchema.index({ actorAdmin: 1, createdAt: -1 });
AdminActivitySchema.index({ createdAt: -1 });
AdminActivitySchema.index({ action: 1, createdAt: -1 });
AdminActivitySchema.index({ result: 1, createdAt: -1 });
AdminActivitySchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
// TTL — تا وقتی expiresAt پر نشود هیچ سندی حذف نمی‌شود.
AdminActivitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ── تغییرناپذیری ─────────────────────────────────────────────────────── */

// هوک‌ها عمداً بدون `next` و به‌صورت throw نوشته شده‌اند: در Mongoose 9 هوکِ
// سنکرون همیشه `next` نمی‌گیرد و اتکا به آن، خودِ نگهبان را می‌شکست.
AdminActivitySchema.pre("save", function preventUpdate() {
  if (!this.isNew) {
    throw new Error("AdminActivity فقط‌افزودنی است: ویرایشِ رکوردِ موجود مجاز نیست.");
  }
});

const BLOCKED_OPERATIONS = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];

for (const operation of BLOCKED_OPERATIONS) {
  AdminActivitySchema.pre(operation, function blockMutation() {
    throw new Error(`AdminActivity فقط‌افزودنی است: عملیاتِ ${operation} مجاز نیست.`);
  });
}

export default mongoose.models.AdminActivity ||
  mongoose.model("AdminActivity", AdminActivitySchema);
