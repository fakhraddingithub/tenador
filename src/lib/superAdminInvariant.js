/**
 * src/lib/superAdminInvariant.js
 *
 * ناوردای «همیشه حداقل یک سوپرادمینِ قابل‌استفاده».
 *
 * قابل‌استفاده = عضویتِ فعال + نقشِ full-access + کاربرِ موجود و غیرمسدود.
 *
 * ── چرا count-then-write کافی نیست ──────────────────────────────────────
 * دو درخواستِ هم‌زمان که *دو ادمینِ متفاوت* را غیرفعال می‌کنند، هر دو count=2
 * می‌بینند، هر دو رد می‌شوند از شرط، و هر دو می‌نویسند → صفر سوپرادمین.
 *
 * ── چرا تراکنشِ ساده هم کافی نیست ───────────────────────────────────────
 * تراکنش‌های MongoDB ایزولاسیونِ snapshot می‌دهند، نه serializable. دو تراکنش
 * که سندهای *متفاوتی* را می‌نویسند هیچ write-conflict ای نمی‌گیرند و هر دو
 * commit می‌شوند. این دقیقاً «write skew» است (همان مثالِ کلاسیکِ پزشکِ کشیک).
 *
 * ── راه‌حل: materialize کردنِ تعارض ─────────────────────────────────────
 * سندِ نقشِ full-access به‌عنوان sentinel استفاده می‌شود: هر عملیاتی که
 * می‌تواند تعداد سوپرادمین‌ها را کم کند، *داخل همان تراکنش* یک نوشتنِ کوچک
 * روی همین یک سند انجام می‌دهد. حالا دو تراکنشِ هم‌زمان روی یک سند می‌نویسند،
 * پس یکی WriteConflict می‌گیرد و دوباره اجرا می‌شود؛ در اجرای دوم شمارشِ
 * به‌روز را می‌بیند و رد می‌کند. هیچ شمارنده‌ی denormalized ای هم نداریم که
 * drift کند — نقش، خودش منبعِ حقیقت است.
 *
 * محیط: production روی Atlas replica set است (تراکنش در دسترس). اگر استقرار
 * تراکنش نداشته باشد، عملیاتِ محافظت‌شده fail-closed رد می‌شود؛ چون بدون
 * سریال‌سازی نمی‌توان ناوردا را تضمین کرد و «تقریباً درست» اینجا یعنی قفلِ
 * کاملِ بیرونِ پنل.
 */

// ایمپورت نسبی (نه alias) تا این ماژول از تستِ node هم قابل بارگذاری باشد و
// تستِ همروندی بتواند *همین کد* را روی یک replica set واقعی اجرا کند.
import mongoose from "mongoose";
import Admin from "../../models/Admin.js";
import AdminRole from "../../models/AdminRole.js";
import User from "../../models/User.js";
import { SUPER_ADMIN_SYSTEM_KEY } from "./permissions.js";
import { countUsableSuperAdmins } from "./adminGuards.js";

/** خطای اختصاصی تا روت بتواند ۴۰۹/۴۲۲ مناسب برگرداند. */
export class SuperAdminInvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = "SuperAdminInvariantError";
  }
}

export class TransactionsUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransactionsUnavailableError";
  }
}

/**
 * sentinel نیست یا یکتا نیست.
 *
 * بدون سندِ sentinel هیچ سریال‌سازی‌ای وجود ندارد، پس تضمینِ ناوردا ممکن نیست
 * و عملیات باید رد شود — نه اینکه «چون نقشی پیدا نشد، بی‌خیالِ محافظت شویم».
 */
export class InvariantSentinelError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvariantSentinelError";
  }
}

/**
 * سند بین خواندن و نوشتن توسط درخواستِ دیگری تغییر کرده (یا حذف شده).
 *
 * جدا از VersionErrorِ خودِ Mongoose است چون بررسیِ نسخه اینجا *دستی* و داخل
 * تراکنش انجام می‌شود (توضیح در saveWithSuperAdminInvariant).
 */
export class ConcurrentModificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConcurrentModificationError";
  }
}

/** فیلترِ سندِ sentinel — هر سه معیار لازم است، نه فقط systemKey. */
const SENTINEL_FILTER = {
  systemKey: SUPER_ADMIN_SYSTEM_KEY,
  isSystem: true,
  isFullAccess: true,
};

/** آیا تراکنش در این استقرار در دسترس است؟ */
export async function transactionsAvailable() {
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    return !!(info?.setName || info?.msg === "isdbgrid");
  } catch {
    return false;
  }
}

/** شمارشِ سوپرادمین‌های قابل‌استفاده — همیشه داخل همان session/تراکنش. */
async function countUsable(superRoleId, session) {
  const admins = await Admin.find({ role: superRoleId, isActive: true })
    .select("user role isActive")
    .session(session)
    .lean();

  const userIds = admins.map((a) => a.user).filter(Boolean);
  const usableUsers = userIds.length
    ? await User.find({ _id: { $in: userIds }, isBanned: { $ne: true } })
        .select("_id")
        .session(session)
        .lean()
    : [];

  return countUsableSuperAdmins(
    admins,
    new Set(usableUsers.map((u) => String(u._id))),
    superRoleId
  );
}

/**
 * اجرای یک تغییرِ حساس با تضمینِ ناوردا.
 *
 * @param {(session) => Promise<any>} mutate تغییر را داخل session انجام دهد.
 * @returns نتیجه‌ی `mutate`
 * @throws {TransactionsUnavailableError|InvariantSentinelError|SuperAdminInvariantError}
 */
export async function withSuperAdminInvariant(mutate) {
  if (!(await transactionsAvailable())) {
    throw new TransactionsUnavailableError(
      "این عملیات برای تضمینِ باقی‌ماندنِ حداقل یک سوپرادمین به تراکنش نیاز دارد و این استقرار MongoDB تراکنش ندارد."
    );
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // ⚠️ retry-safe: withTransaction ممکن است این callback را (روی
      // TransientTransactionError مثل WriteConflict) دوباره اجرا کند. نتیجه‌ی
      // تلاشِ قبلی نباید باقی بماند.
      result = undefined;

      // ── sentinel ─────────────────────────────────────────────────────
      // نوشتنِ روی همین یک سند، تعارضِ منطقی را به تعارضِ واقعیِ نوشتن تبدیل
      // می‌کند تا دو تراکنشِ هم‌زمان نتوانند هر دو commit شوند.
      //
      // `$inc` روی فیلدی که *در اسکیما تعریف شده* — با strict:true هر فیلدِ
      // ناشناخته از update حذف می‌شد و sentinel عملاً هیچ نوشتنی نمی‌کرد
      // (باگِ خاموشِ نسخه‌ی قبلی: invariantTouchedAt در اسکیما نبود).
      //
      // updateMany به‌جای updateOne فقط برای این است که matchedCount بگوید
      // «دقیقاً یکی» بود یا نه؛ صفر و دوتا هر دو fail-closed اند.
      const bumped = await AdminRole.updateMany(
        SENTINEL_FILTER,
        { $inc: { invariantRevision: 1 } },
        { session }
      );

      if (bumped.matchedCount !== 1) {
        throw new InvariantSentinelError(
          bumped.matchedCount === 0
            ? "نقشِ محافظت‌شده‌ی «دسترسی کامل» پیدا نشد؛ بدون آن نمی‌توان این عملیات را ایمن انجام داد."
            : "بیش از یک نقشِ محافظت‌شده‌ی «دسترسی کامل» وجود دارد؛ وضعیت داده مبهم است."
        );
      }

      // شمارش فقط بر پایه‌ی همین یک نقش انجام می‌شود؛ اگر نقشِ full-accessِ
      // دیگری وجود داشته باشد، دارندگانش «سوپرادمینِ قابل‌استفاده» هستند ولی
      // شمرده نمی‌شوند و شمارشِ «قبل» به‌غلط صفر می‌شود (یعنی fail-open).
      // چنین نقشی از API ساختنی نیست (stripProtectedRoleFields)، پس اگر بود
      // یعنی داده مبهم است → رد.
      const fullAccessRoles = await AdminRole.countDocuments(
        { isFullAccess: true },
        { session }
      );
      if (fullAccessRoles !== 1) {
        throw new InvariantSentinelError(
          "بیش از یک نقشِ «دسترسی کامل» در دیتابیس هست؛ تا تعیین تکلیفِ آن این عملیات انجام نمی‌شود."
        );
      }

      const sentinel = await AdminRole.findOne(SENTINEL_FILTER)
        .select("_id")
        .session(session)
        .lean();

      // ── شمارش قبل و بعد، داخل همان تراکنش ────────────────────────────
      // قاعده: «هرگز از ≥۱ به ۰ نرو». اگر از قبل صفر بوده (وضعیتِ امروزِ
      // دیتابیس: ۸ ادمینِ legacy و صفر عضویتِ لینک‌شده) بستنِ عملیات چیزی را
      // نجات نمی‌دهد و در عوض مدیریت ادمین‌ها و مسدودسازیِ کاربران را کاملاً
      // قفل می‌کند. چون گذار ۰→≥۱ آزاد است و ≥۱→۰ ممنوع، به‌محض وجودِ اولین
      // سوپرادمینِ قابل‌استفاده ناوردا برای همیشه برقرار می‌ماند.
      const before = await countUsable(sentinel._id, session);

      result = await mutate(session);

      const after = await countUsable(sentinel._id, session);

      if (after === 0 && before > 0) {
        throw new SuperAdminInvariantError(
          "این تغییر آخرین سوپرادمینِ فعال را از بین می‌برد و انجام نشد."
        );
      }
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * ذخیره‌ی سندی که *بیرون* از تراکنش تغییر داده شده، به‌شکلِ امن در برابرِ retry.
 *
 * ── چرا `withSuperAdminInvariant((s) => doc.save({ session: s }))` غلط بود ──
 * `withTransaction` روی WriteConflict — یعنی دقیقاً همان چیزی که sentinel
 * عمداً می‌سازد — کل callback را دوباره اجرا می‌کند. ولی `doc.save()` بعد از
 * تلاشِ اول سند را «تمیز» می‌کند: در تلاشِ دوم دلتایی نمانده، پس Mongoose
 * بی‌صدا هیچ نمی‌نویسد و تراکنش با موفقیت commit می‌شود. نتیجه: API با ۲۰۰
 * برمی‌گردد در حالی که هیچ چیزی تغییر نکرده — از دست رفتنِ خاموشِ نوشتن، و
 * دقیقاً در پرتعارض‌ترین حالت. (با optimisticConcurrency بدتر هم می‌شد:
 * `__v`ِ درون‌حافظه‌ای در تلاشِ اول بالا رفته بود، پس تلاشِ دوم VersionError
 * می‌داد و کاربر ۴۰۹ می‌گرفت بدون اینکه هیچ‌کس هم‌زمان چیزی تغییر داده باشد.)
 *
 * راه‌حل: دلتا یک‌بار بیرون گرفته می‌شود و هر تلاش آن را روی سندی که *داخلِ
 * همان تلاش* خوانده شده دوباره اعمال می‌کند — یعنی عملیات idempotent است.
 * کنترلِ همروندیِ خوش‌بینانه هم دستی و صریح انجام می‌شود، وگرنه `save()` روی
 * سندِ تازه‌خوانده‌شده همیشه با نسخه‌ی خودش می‌خواند و هرگز تعارض نمی‌بیند.
 *
 * @param {import("mongoose").Document} doc سندِ از قبل تغییریافته (ذخیره‌نشده)
 * @returns سندِ ذخیره‌شده
 */
export async function saveWithSuperAdminInvariant(doc) {
  const Model = doc.constructor;
  const changes = doc.$getChanges();
  const seenVersion = doc.get("__v");

  return withSuperAdminInvariant(async (session) => {
    const fresh = await Model.findById(doc._id).session(session);
    if (!fresh) {
      throw new ConcurrentModificationError("سند دیگر وجود ندارد");
    }
    if (typeof seenVersion === "number" && fresh.get("__v") !== seenVersion) {
      throw new ConcurrentModificationError("نسخه‌ی سند تغییر کرده است");
    }

    for (const [pathName, value] of Object.entries(changes.$set || {})) {
      fresh.set(pathName, value);
    }
    for (const pathName of Object.keys(changes.$unset || {})) {
      fresh.set(pathName, undefined);
    }

    return fresh.save({ session });
  });
}

/**
 * نگاشتِ خطاهای ناوردا به پاسخ HTTP — یک نسخه برای همه‌ی روت‌ها.
 *
 * خروجی `null` یعنی «این خطا مربوط به ناوردا نیست»؛ روت باید آن را دوباره
 * throw کند تا در catchِ عمومی به ۵۰۰ تبدیل شود.
 *
 * `Response` استاندارد (نه NextResponse) تا این ماژول از تستِ node هم قابل
 * بارگذاری بماند.
 */
export function invariantResponse(error) {
  if (error instanceof SuperAdminInvariantError) {
    return Response.json({ message: error.message }, { status: 409 });
  }
  if (error instanceof ConcurrentModificationError) {
    return Response.json(
      {
        message:
          "این رکورد هم‌زمان توسط درخواست دیگری تغییر کرد؛ صفحه را تازه کنید و دوباره تلاش کنید",
      },
      { status: 409 }
    );
  }
  if (
    error instanceof TransactionsUnavailableError ||
    error instanceof InvariantSentinelError
  ) {
    console.error(`[authz] super-admin invariant unavailable: ${error.message}`);
    return Response.json(
      {
        message:
          "این عملیات در حال حاضر قابل انجام نیست (محدودیت زیرساخت پایگاه داده).",
      },
      { status: 503 }
    );
  }
  return null;
}
