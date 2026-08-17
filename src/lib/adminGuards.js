/**
 * src/lib/adminGuards.js
 *
 * تصمیم‌های امنیتیِ خالص (بدون I/O) برای پنل ادمین.
 *
 * چرا جدا از adminContext؟ چون adminContext به next/headers و دیتابیس وابسته
 * است و قابل تست مستقیم نیست. منطقِ تصمیم اینجاست تا هم تست شود و هم
 * تنها یک نسخه از قواعد وجود داشته باشد.
 *
 * ⚠️ فاز ۱: فقط `decideMembershipAccess` واقعاً استفاده می‌شود (در adminContext).
 * بقیه‌ی گاردها زیرساختِ آماده‌ی فاز enforcement اند و هنوز به هیچ روتی وصل
 * نشده‌اند — نقطه‌ی اتصال در کامنت هر تابع مشخص شده است.
 */

// ایمپورت نسبی (نه alias) تا این ماژول از اسکریپت/تستِ node هم قابل ایمپورت باشد.
import { hasPermission, isProtectedRole } from "./permissions.js";

/**
 * تصمیمِ گیتِ روت — تنها منبعِ قرارداد ۴۰۱/۴۰۳.
 *
 * مرزِ معنایی:
 *   ۴۰۱ «تو کی هستی؟»   → هیچ هویتی نداریم: توکن نیست/نامعتبر است، یا کاربرِ
 *                          توکن در دیتابیس نیست. تنها حالتی که ctx برابر null است.
 *   ۴۰۳ «تو اجازه نداری» → هویت داریم ولی مجاز نیست: بدون عضویت و بدون نقش
 *                          legacy، عضویتِ لغو‌شده/غیرفعال، عضویتِ تکراری،
 *                          کاربرِ مسدود، یا نداشتنِ همان کلید.
 *
 * ۴۰۱ دادن به کاربرِ لاگین‌کرده‌ی غیرمجاز غلط بود: کلاینت آن را «نشستت منقضی
 * شده» تفسیر می‌کند و کاربر را به لاگین می‌فرستد، در حالی که مشکل نشست نیست.
 *
 * `outcome` فقط برای لاگ/تست است و هرگز نباید در بدنه‌ی پاسخ برگردد.
 */
export function decideGateOutcome({ ctx, required = null, mode = "all" } = {}) {
  if (!ctx) return { status: 401, outcome: "no-identity" };

  if (!ctx.isAdmin) {
    return { status: 403, outcome: ctx.denyReason || "not-an-admin" };
  }

  if (required !== null && required !== undefined) {
    const keys = Array.isArray(required) ? required : [required];

    // ⚠️ دفاع در عمق: آرایه‌ی خالی در JS truthy است و
    // `hasPermission(x, [], {mode:"all"})` هم true می‌دهد. اگر resolverِ
    // شاخه‌ای «رد» را به‌صورت آرایه‌ی خالی برساند، بدون این شرط تبدیل به
    // «هیچ کلیدی لازم نیست» و در نتیجه *مجاز* می‌شد.
    if (!keys.length) return { status: 403, outcome: "empty-requirement" };

    if (!hasPermission(ctx.permissions || [], keys, { mode })) {
      return { status: 403, outcome: "missing-permission" };
    }
  }

  return { status: 200, outcome: "allow" };
}

/**
 * آیا این نشست حق ورود به پنل را دارد؟
 *
 * ورودی عمداً «همه‌ی» عضویت‌های کاربر است (نه فقط فعال‌ها) تا حالت
 * «عضویتِ لغو‌شده» با حالت «اصلاً عضویت ندارد» اشتباه گرفته نشود؛ در غیر این
 * صورت یک ادمینِ لغو‌شده دوباره از مسیر legacy (User.role === "admin") وارد
 * می‌شد — یعنی fail-open.
 *
 * قواعد:
 *   • بیش از یک عضویت  → رد (پیش از ایندکس یکتا ممکن است داده‌ی تکراری باشد؛
 *                          انتخابِ دلبخواهیِ یک ردیف امن نیست)
 *   • یک عضویتِ غیرفعال → رد، و هرگز بازگشت به legacy
 *   • یک عضویتِ فعال    → قبول (منبع: membership)
 *   • بدون هیچ عضویتی   → فقط در این حالت legacy مجاز است
 */
export function decideMembershipAccess({
  memberships = [],
  hasLegacyAdminRole = false,
} = {}) {
  const list = Array.isArray(memberships) ? memberships : [];

  if (list.length > 1) {
    return {
      allowed: false,
      source: "none",
      membership: null,
      reason: "duplicate-membership",
    };
  }

  if (list.length === 1) {
    const membership = list[0];
    if (!membership?.isActive) {
      return {
        allowed: false,
        source: "none",
        membership,
        reason: membership?.revokedAt ? "membership-revoked" : "membership-inactive",
      };
    }
    return {
      allowed: true,
      source: "membership",
      membership,
      reason: null,
    };
  }

  // ── مسیر legacy در فاز ۷ بسته شد ──────────────────────────────────────
  // تا پیش از کات‌اوور، `User.role === "admin"` به‌تنهایی دسترسیِ کامل می‌داد
  // تا ادمین‌های موجود قفلِ بیرون نشوند. مهاجرت اجرا شد و از آن پس تنها
  // منبعِ مجوزِ پنل، عضویتِ فعالِ Admin است. پارامتر `hasLegacyAdminRole`
  // عمداً در امضا مانده تا فراخوان‌ها نشکنند، ولی دیگر هیچ اثری ندارد و
  // همین را تست تثبیت می‌کند.
  void hasLegacyAdminRole;

  return {
    allowed: false,
    source: "none",
    membership: null,
    reason: "no-membership",
  };
}

/** سقف طول دلیلِ لغو دسترسی. */
export const MAX_REVOKE_REASON_LENGTH = 300;

/**
 * مرزِ اعتبارسنجیِ payloadِ وضعیت.
 *
 * `isActive` باید boolean *واقعی* باشد: با `!!` رشته‌ی "false" یا "0" به
 * «فعال‌سازی» تبدیل می‌شد — یعنی یک تایپِ ساده در کلاینت می‌توانست دسترسیِ
 * لغو‌شده را برگرداند. اینجا ۴۲۲ می‌دهیم، نه تفسیر.
 */
export function validateStatusPayload({ isActive, revokeReason } = {}) {
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return {
      ok: false,
      message: "مقدار isActive باید دقیقاً true یا false باشد",
    };
  }

  let reason = "";
  if (revokeReason !== undefined && revokeReason !== null) {
    if (typeof revokeReason !== "string") {
      return { ok: false, message: "دلیل لغو دسترسی باید متن باشد" };
    }
    reason = revokeReason.trim();
    if (reason.length > MAX_REVOKE_REASON_LENGTH) {
      return {
        ok: false,
        message: `دلیل لغو دسترسی حداکثر ${MAX_REVOKE_REASON_LENGTH} کاراکتر است`,
      };
    }
  }

  return { ok: true, isActive, revokeReason: reason, message: "" };
}

/**
 * مرزِ اعتبارسنجیِ عددی/بولیِ `PATCH /api/admin/users/[userId]`.
 *
 * چرا اینجا (کنارِ بقیه‌ی تصمیم‌های خالص) و نه داخل روت: بدون I/O است، پس
 * مستقیماً تست می‌شود و رفتارش یک نسخه بیشتر ندارد.
 *
 * سه باگِ واقعیِ روتِ قبلی که اینجا بسته می‌شود:
 *   • `Boolean(body.isBanned)` رشته‌ی "false" را *مسدودسازی* می‌کرد.
 *   • `Number(x) || 0` هر ورودیِ نامعتبر (و حتی "" و null) را بی‌صدا به صفر
 *     تبدیل می‌کرد — یعنی یک تایپ، کیفِ پولِ کاربر را خالی می‌کرد.
 *   • مقدار منفی هیچ‌جا رد نمی‌شد.
 *
 * رشته‌ی عددی عمداً پذیرفته می‌شود: فرمِ فعلی مقدار input را خام می‌فرستد
 * ("150000"). آنچه رد می‌شود «عددِ نامعتبر» است، نه «رشته».
 */
function parseFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function validateUserPatchPayload(body = {}) {
  const values = {};

  if (body.isBanned !== undefined) {
    if (typeof body.isBanned !== "boolean") {
      return { ok: false, message: "مقدار isBanned باید دقیقاً true یا false باشد", values };
    }
    values.isBanned = body.isBanned;
  }

  if (body.walletBalance !== undefined) {
    const n = parseFiniteNumber(body.walletBalance);
    if (n === null || n < 0) {
      return {
        ok: false,
        message: "موجودی کیف پول باید یک عدد معتبر و غیرمنفی باشد",
        values,
      };
    }
    values.walletBalance = n;
  }

  if (body.level !== undefined) {
    const n = parseFiniteNumber(body.level);
    // سطح یک شناسه‌ی گسسته است (۰ عادی … ۳ پلاتینیوم)، پس اعشار بی‌معناست.
    // سقفِ عددی عمداً تحمیل نمی‌شود: اسکیما enum ندارد و ساختنِ محدودیتی که
    // در مدل نیست، رفتارِ موجود را بی‌دلیل می‌شکند.
    if (n === null || n < 0 || !Number.isInteger(n)) {
      return {
        ok: false,
        message: "سطح کاربر باید یک عدد صحیح و غیرمنفی باشد",
        values,
      };
    }
    values.level = n;
  }

  return { ok: true, message: "", values };
}

/**
 * هویتِ نمایشیِ یک عضویت — همیشه از روی کاربرِ لینک‌شده ساخته می‌شود.
 *
 * فاز ۳: نام/نام‌کاربری/ایمیلِ ادمین دیگر دستی وارد نمی‌شوند. یک تعریف برای
 * هر دو مصرف‌کننده (مهاجرت و POST /api/admin/admins) تا دو ادمینِ ساخته‌شده
 * از دو مسیر، دو شکلِ متفاوت نداشته باشند.
 */
export function deriveDisplayName(user) {
  const full = [user?.name, user?.lastName].filter(Boolean).join(" ").trim();
  return full || user?.phone || user?.email || "ادمین";
}

/**
 * نام کاربریِ قطعی و یکتا.
 *
 * عمداً از `_id` ساخته می‌شود، نه از نام/ایمیل: پایدار است، با تغییر نامِ
 * کاربر عوض نمی‌شود، همیشه با الگوی `^[a-z0-9_.-]{3,30}$` می‌خواند و هیچ
 * داده‌ی شخصی‌ای در آن نیست.
 *
 * @param {{_id: any}} user
 * @param {Set<string>|string[]} taken نام‌های از قبل گرفته‌شده
 */
export function deriveUsername(user, taken) {
  const used = taken instanceof Set ? taken : new Set(taken || []);
  const base = `admin-${String(user?._id ?? "").slice(-8).toLowerCase()}`;
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * فیلدهای متنیِ اختیاریِ بدنه‌ی درخواست.
 *
 * الگوی `body.title?.trim()` روی ورودیِ غیرمتنی (عدد، آرایه، شیء) TypeError
 * می‌داد و در catchِ عمومی به ۵۰۰ تبدیل می‌شد. ورودیِ بدشکل خطای کاربر است.
 *
 * `null` و `""` عمداً معتبرند و به `""` نگاشت می‌شوند — یعنی «پاک کن»؛ همان
 * رفتارِ قبلیِ `value?.trim() || ""`.
 *
 * @param {object} body
 * @param {string[]} fields
 * @returns {{ok: boolean, field: string|null, message: string, values: object}}
 *          `values` فقط شاملِ فیلدهایی است که در بدنه آمده‌اند.
 */
export function validateOptionalText(body = {}, fields = []) {
  const values = {};

  for (const field of fields) {
    const raw = body?.[field];
    if (raw === undefined) continue;

    if (raw === null || raw === "") {
      values[field] = "";
      continue;
    }

    if (typeof raw !== "string") {
      return {
        ok: false,
        field,
        message: `مقدار «${field}» باید متن باشد`,
        values,
      };
    }

    values[field] = raw.trim();
  }

  return { ok: true, field: null, message: "", values };
}

/**
 * تفسیر نتیجه‌ی لغوِ شرطیِ اتمیک (`findOneAndUpdate` روی `isActive: true`).
 *
 * miss دو معنی کاملاً متفاوت دارد و نباید یکی شوند:
 *   • سند اصلاً وجود ندارد        → ۴۰۴
 *   • سند هست ولی از قبل لغو شده  → ۲۰۰ (idempotent، بدون بازنویسیِ ممیزی)
 */
export function interpretRevokeOutcome({ updated, exists }) {
  if (updated) {
    return { status: 200, outcome: "revoked", message: "دسترسی ادمین لغو شد" };
  }
  if (exists) {
    return {
      status: 200,
      outcome: "already-revoked",
      message: "دسترسی این ادمین از قبل لغو شده است",
    };
  }
  return { status: 404, outcome: "not-found", message: "ادمین یافت نشد" };
}

/**
 * گذارِ وضعیتِ عضویت (فعال‌سازی / لغو) — تنها منبعِ این منطق.
 *
 * هیچ سندی حذف نمی‌شود: لغو دسترسی یعنی isActive=false به‌علاوه‌ی متادیتای
 * ممیزی. idempotent است: اگر وضعیت همان است که خواسته شده، هیچ فیلدی تغییر
 * نمی‌کند تا revokedAt/revokedBy اولیه بازنویسی نشود.
 *
 * خروجی: { changed, patch } — patch مستقیماً روی سند/`$set` اعمال می‌شود تا
 * PUT و DELETE دقیقاً یک رفتار داشته باشند.
 */
export function applyAdminStatusTransition({
  current,
  nextActive,
  actorUserId = null,
  reason = "",
  now = new Date(),
} = {}) {
  // بدون `!!`: مقدارِ غیرboolean باید بالادست رد شده باشد. اینجا هم سخت‌گیر
  // می‌مانیم تا رشته‌ی "false" هرگز به «فعال‌سازی» تعبیر نشود.
  if (typeof nextActive !== "boolean") {
    return { changed: false, patch: {}, error: "non-boolean-status" };
  }

  const isActive = current?.isActive === true;
  const target = nextActive;

  if (isActive === target) return { changed: false, patch: {} };

  if (target) {
    return {
      changed: true,
      patch: {
        isActive: true,
        activatedAt: now,
        activatedBy: actorUserId,
        revokedAt: null,
        revokedBy: null,
        revokeReason: "",
        updatedBy: actorUserId,
      },
    };
  }

  return {
    changed: true,
    patch: {
      isActive: false,
      revokedAt: now,
      revokedBy: actorUserId,
      revokeReason: String(reason || "").trim(),
      updatedBy: actorUserId,
    },
  };
}

/**
 * جلوگیری از ارتقای دسترسیِ خود یا دیگری: کسی نمی‌تواند کلیدی بدهد که خودش
 * ندارد. دارنده‌ی نقشِ «دسترسی کامل» از این قاعده مستثناست.
 *
 * نقطه‌ی اتصال فاز ۲: POST/PUT در api/admin/admins و api/admin/roles، پس از
 * validatePermissionKeys و پیش از ذخیره.
 */
export function assertNoPrivilegeEscalation({
  actorPermissions = [],
  actorIsFullAccess = false,
  requestedPermissions = [],
} = {}) {
  if (actorIsFullAccess) return { ok: true, escalated: [] };

  const held = new Set(actorPermissions);
  const escalated = [...new Set(requestedPermissions)].filter(
    (key) => !held.has(key)
  );

  return { ok: escalated.length === 0, escalated };
}

/**
 * چند سوپرادمینِ *قابل‌استفاده* در این وضعیت وجود دارد؟
 *
 * قابل‌استفاده = عضویتِ فعال + نقشِ full-access + کاربرِ موجود و غیرمسدود.
 * اینجا (کنارِ بقیه‌ی تصمیم‌های خالص) نگه داشته می‌شود تا بدون دیتابیس تست
 * شود؛ پوسته‌ی تراکنشی‌اش در src/lib/superAdminInvariant.js است.
 */
export function countUsableSuperAdmins(admins, usableUserIds, superRoleId) {
  if (!superRoleId) return 0;
  const usable =
    usableUserIds instanceof Set ? usableUserIds : new Set(usableUserIds || []);

  return (admins || []).filter(
    (a) =>
      a &&
      a.isActive === true &&
      a.user &&
      String(a.role) === String(superRoleId) &&
      usable.has(String(a.user))
  ).length;
}

/**
 * آیا این actor حق دارد چنین نقشی را به کسی بدهد؟
 *
 * دو خطر:
 *   ۱) دادنِ نقشِ full-access توسط کسی که خودش full-access نیست → ساختنِ
 *      سوپرادمین از پایین.
 *   ۲) دادنِ نقشی که کلیدهایی فراتر از خودِ actor دارد → ارتقای غیرمستقیم.
 */
export function assertRoleAssignable({
  actorPermissions = [],
  actorIsFullAccess = false,
  role,
} = {}) {
  if (!role) return { ok: false, reason: "role-missing", escalated: [] };

  if (role.isFullAccess && !actorIsFullAccess) {
    return { ok: false, reason: "cannot-grant-full-access", escalated: [] };
  }

  const escalation = assertNoPrivilegeEscalation({
    actorPermissions,
    actorIsFullAccess,
    requestedPermissions: role.permissions || [],
  });

  return escalation.ok
    ? { ok: true, reason: null, escalated: [] }
    : { ok: false, reason: "role-exceeds-actor", escalated: escalation.escalated };
}

/**
 * آیا actor حق دارد این نقش را ویرایش/حذف کند؟
 *
 * فقط «سیستمی بودن» کافی نیست: یک نقشِ عادی که کلیدهایی فراتر از actor دارد
 * هم نباید توسط او تضعیف یا دست‌کاری شود، وگرنه actorِ ضعیف می‌تواند نقشِ
 * قوی‌تر را خالی کند و عملاً ادمین‌های آن نقش را از کار بیندازد.
 */
export function assertRoleModifiable({
  actorPermissions = [],
  actorIsFullAccess = false,
  role,
} = {}) {
  const protectedCheck = canModifyRole(role);
  if (!protectedCheck.ok) return { ...protectedCheck, escalated: [] };

  if (actorIsFullAccess) return { ok: true, reason: null, escalated: [] };

  const held = new Set(actorPermissions);
  const beyond = (role.permissions || []).filter((k) => !held.has(k));
  if (beyond.length) {
    return { ok: false, reason: "role-stronger-than-actor", escalated: beyond };
  }

  return { ok: true, reason: null, escalated: [] };
}

/**
 * جلوگیری از قفل‌شدنِ خود و از دست‌کاریِ ادمینِ قوی‌تر.
 *
 * نقطه‌ی اتصال فاز ۲: PUT/DELETE در api/admin/admins/[id].
 */
export function canManageAdmin({
  actorUserId,
  actorIsFullAccess = false,
  target,
  targetRoleIsFullAccess = false,
} = {}) {
  if (!target) return { ok: false, reason: "target-missing" };

  if (actorUserId && String(target.user || "") === String(actorUserId)) {
    return { ok: false, reason: "self-management" };
  }

  if (targetRoleIsFullAccess && !actorIsFullAccess) {
    return { ok: false, reason: "target-is-super-admin" };
  }

  return { ok: true, reason: null };
}

/**
 * نقشِ محافظت‌شده از مسیر API نه ویرایش می‌شود نه حذف.
 *
 * نقطه‌ی اتصال فاز ۲ (و همین حالا در api/admin/roles/[id]).
 */
export function canModifyRole(role) {
  if (!role) return { ok: false, reason: "role-missing" };
  if (isProtectedRole(role)) return { ok: false, reason: "protected-role" };
  return { ok: true, reason: null };
}
