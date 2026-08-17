/**
 * src/lib/adminActivity.js
 *
 * سرویسِ دفترِ فعالیتِ ادمین — فاز ۶.
 *
 * ── سه قاعده‌ی غیرقابل‌مذاکره ────────────────────────────────────────────
 *
 * ۱. **ثبت هرگز عملیاتِ اصلی را نمی‌شکند.** هر خطایی اینجا بلعیده و روی
 *    console گزارش می‌شود. اگر دفترِ ممیزی بتواند تأییدِ پرداخت را fail کند،
 *    اولین کاری که در حادثه انجام می‌شود خاموش‌کردنِ ممیزی است.
 *
 * ۲. **ثبت هرگز مجوز نمی‌دهد.** این ماژول فقط می‌نویسد؛ هیچ تابعی اینجا
 *    خروجی‌اش روی تصمیمِ دسترسی اثر ندارد.
 *
 * ۳. **هیچ رازی وارد دفتر نمی‌شود.** فیلترِ حذف پیش از هر نوشتن اجرا می‌شود و
 *    بر اساس *نامِ فیلد* کار می‌کند، نه بر اساس اینکه فراخوان یادش باشد.
 *
 * ── معناشناسیِ قابلیت اطمینان ───────────────────────────────────────────
 * نوشتن «بهترین تلاش» و غیرمسدودکننده است: تابع بدون انتظار برای پایانِ
 * نوشتن برمی‌گردد مگر اینکه `await` شود. یعنی در سقوطِ فرایند ممکن است آخرین
 * رکورد از دست برود. این معامله آگاهانه است: از دست رفتنِ یک رکورد بهتر از
 * شکستنِ عملیاتِ کاربر است. برای اقدامات پرارزش (تغییرِ دسترسی، پول)
 * فراخوان می‌تواند `await` کند تا نوشتن قبل از پاسخ قطعی شود.
 */

// ایمپورتِ نسبی (نه alias) تا این ماژول از تستِ node هم قابل بارگذاری باشد —
// همان قاعده‌ای که superAdminInvariant.js دارد.
import mongoose from "mongoose";
import AdminActivity from "../../models/AdminActivity.js";

/**
 * اتصال، فقط اگر لازم باشد.
 *
 * `configs/db.js` خودش با aliasِ `base/*` نوشته شده و در محیطِ تست قابل
 * بارگذاری نیست؛ چون آنجا mongoose از قبل به دیتابیسِ حافظه‌ای وصل است،
 * ایمپورتِ پویا هرگز اجرا نمی‌شود. در production هم یک فراخوانیِ اضافه کم
 * می‌شود.
 */
async function ensureConnection() {
  if (mongoose.connection?.readyState === 1) return;
  const { default: connectToDB } = await import("../../configs/db.js");
  await connectToDB();
}

/* ────────────────────────────────────────────────────────────────────────────
 * حذفِ اسرار
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * نامِ فیلدهایی که هرگز نباید ثبت شوند. مقایسه روی نامِ *نرمال‌شده* انجام
 * می‌شود (بدونِ _ و -، حروف کوچک) تا `access_token` و `accessToken` هر دو
 * بگیرند.
 */
const SECRET_FIELDS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "passwordhash",
  "hash",
  "salt",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "secret",
  "clientsecret",
  "privatekey",
  "otp",
  "otpcode",
  "code",
  "verificationcode",
  "authorization",
  "cookie",
  "session",
  "cvv",
  "cardnumber",
  "pan",
  "iban",
  "shebanumber",
  "accountnumber",
]);

/** فیلدهایی که خودشان راز نیستند ولی URLِ سندِ خصوصی‌اند. */
const PRIVATE_URL_FIELDS = new Set([
  "certificateimage",
  "personalimage",
  "nationalcardimage",
  "documenturl",
  "receiptimageurl",
]);

export const REDACTED = "[حذف‌شده]";

const normalizeFieldName = (name) => String(name).toLowerCase().replace(/[_-]/g, "");

export function isSecretField(name) {
  return SECRET_FIELDS.has(normalizeFieldName(name));
}

export function isPrivateUrlField(name) {
  return PRIVATE_URL_FIELDS.has(normalizeFieldName(name));
}

const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_DEPTH = 4;

/**
 * پاک‌سازیِ بازگشتیِ یک مقدار برای ثبت.
 *
 * علاوه بر حذفِ اسرار، اندازه را هم مهار می‌کند: بدنه‌ی خامِ یک درخواستِ
 * بزرگ نباید دفتر را پر کند (و رشته‌ی طولانی خودش می‌تواند حاملِ داده‌ی
 * حساس باشد).
 */
export function redact(value, depth = 0) {
  if (value === null || value === undefined) return value ?? null;

  const type = typeof value;
  if (type === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (type === "number" || type === "boolean") return value;
  if (type === "bigint" || type === "function" || type === "symbol") return String(type);

  if (value instanceof Date) return value.toISOString();
  // ObjectId و هر چیزی که toHexString دارد
  if (typeof value.toHexString === "function") return value.toHexString();

  if (depth >= MAX_DEPTH) return "[عمق زیاد]";

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`… ${value.length - MAX_ARRAY} مورد دیگر`);
    return items;
  }

  if (type === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSecretField(key)) out[key] = REDACTED;
      else if (isPrivateUrlField(key)) out[key] = item ? "[سندِ خصوصی]" : null;
      else out[key] = redact(item, depth + 1);
    }
    return out;
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * تفاوتِ قبل/بعد
 * ──────────────────────────────────────────────────────────────────────────── */

const sameValue = (a, b) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
};

/**
 * تفاوتِ دو سند به شکل `{ field: { from, to } }`.
 *
 * فقط فیلدهایی که *واقعاً* عوض شده‌اند می‌آیند؛ رکوردی که ۴۰ فیلدِ بی‌تغییر
 * دارد قابل خواندن نیست. مقادیر از فیلترِ حذف عبور می‌کنند.
 *
 * @param {object|null} before
 * @param {object|null} after
 * @param {string[]|null} fields اگر داده شود، فقط همین فیلدها مقایسه می‌شوند.
 */
export function diffDocuments(before, after, fields = null) {
  const source = before && typeof before === "object" ? before : {};
  const target = after && typeof after === "object" ? after : {};

  const keys = fields
    ? [...new Set(fields)]
    : [...new Set([...Object.keys(source), ...Object.keys(target)])];

  const changes = {};
  for (const key of keys) {
    if (key === "_id" || key === "__v" || key === "updatedAt") continue;

    const from = source[key];
    const to = target[key];
    if (sameValue(from, to)) continue;

    if (isSecretField(key)) {
      // خودِ «عوض شد» اطلاعِ مفیدی است؛ مقدارها نه.
      changes[key] = { from: REDACTED, to: REDACTED };
      continue;
    }

    changes[key] = { from: redact(from), to: redact(to) };
  }

  return Object.keys(changes).length ? changes : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * زمینه‌ی درخواست
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * IPِ کلاینت.
 *
 * ⚠️ `x-forwarded-for` را فقط وقتی می‌پذیریم که پشتِ یک پراکسیِ مورداعتماد
 * باشیم. روی Vercel همیشه هستیم، ولی در اجرای مستقیم این هدر ساختنی است و
 * اعتماد به آن یعنی می‌شود ردِ ممیزی را جعل کرد. با
 * `TRUSTED_PROXY=false` می‌توان صریح خاموشش کرد.
 */
export function clientIpFrom(headers) {
  const trusted = process.env.TRUSTED_PROXY !== "false";
  if (!trusted) return "";

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 60);
  return (headers.get("x-real-ip") || "").slice(0, 60);
}

/** زمینه‌ی درخواست از هدرها — در محیطِ غیرِ درخواست، مقادیرِ خالی. */
export async function requestContext() {
  try {
    const { headers } = await import("next/headers");
    const list = await headers();
    return {
      ip: clientIpFrom(list),
      userAgent: (list.get("user-agent") || "").slice(0, 300),
      requestId:
        list.get("x-request-id") ||
        list.get("x-vercel-id") ||
        globalThis.crypto?.randomUUID?.() ||
        "",
    };
  } catch {
    return { ip: "", userAgent: "", requestId: "" };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * ثبت
 * ──────────────────────────────────────────────────────────────────────────── */

/** عکسِ لحظه‌ای از بازیگر، از روی زمینه‌ی حل‌شده‌ی ادمین. */
export function actorSnapshotFrom(ctx) {
  return {
    name: [ctx?.user?.name, ctx?.user?.lastName].filter(Boolean).join(" ").trim() || "",
    username: ctx?.membership?.username || "",
    roleName: ctx?.role?.name || "",
    roleId: ctx?.role?._id || null,
    isFullAccess: !!ctx?.isFullAccess,
    source: ctx?.source || "none",
    permissionCount: Array.isArray(ctx?.permissions) ? ctx.permissions.length : 0,
  };
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * نوشتنِ یک رکورد. هرگز throw نمی‌کند.
 *
 * @returns {Promise<boolean>} آیا نوشته شد.
 */
export async function recordAdminActivity({
  ctx = null,
  action,
  permissions = [],
  method = "",
  route = "",
  resource = null,
  result,
  statusCode = 0,
  reason = "",
  metadata = null,
  changes = null,
} = {}) {
  try {
    if (!action || !result) return false;

    const request = await requestContext();

    await ensureConnection();
    await AdminActivity.create({
      actorUser: ctx?.user?._id || null,
      actorAdmin: ctx?.membership?._id || null,
      actorSnapshot: actorSnapshotFrom(ctx),
      action,
      permissions: asArray(permissions).filter((k) => typeof k === "string"),
      method,
      route,
      resourceType: resource?.type || "",
      resourceId: resource?.id ? String(resource.id) : "",
      resourceLabel: resource?.label ? String(resource.label).slice(0, 200) : "",
      result,
      statusCode,
      reason,
      requestId: request.requestId,
      ip: request.ip,
      userAgent: request.userAgent,
      metadata: metadata ? redact(metadata) : null,
      changes: changes || null,
    });

    return true;
  } catch (error) {
    // قاعده‌ی ۱: شکستِ ممیزی نباید عملیات را بشکند.
    console.error("[adminActivity] ثبت نشد:", error?.message || error);
    return false;
  }
}

/**
 * سازنده‌ی یک ثبت‌کننده‌ی مقید به زمینه — تا هندلر به‌جای پنج آرگومان، دو خط
 * بنویسد:
 *
 *   const audit = auditor(ctx, { action: "role.update", permissions: ["roles.edit"],
 *                                method: "PUT", route: "/admin/roles/[id]" });
 *   ...
 *   await audit.success({ resource, changes });
 *
 * هر دو متد Promise برمی‌گردانند؛ `await` اختیاری است. برای اقدامات پرارزش
 * (پول، دسترسی) بهتر است await شود تا رکورد قبل از پاسخ قطعی شود.
 */
export function auditor(ctx, base = {}) {
  const emit = (result, extra = {}, fallbackStatus) =>
    recordAdminActivity({
      ctx,
      ...base,
      ...extra,
      result,
      statusCode: extra.statusCode ?? fallbackStatus,
    });

  return {
    success: (extra) => emit("success", extra, 200),
    failure: (extra) => emit("failure", extra, 500),
  };
}

/**
 * ثبتِ ردِ مجوز. از داخلِ گیت صدا زده می‌شود، پس هیچ روتی لازم نیست کاری کند.
 */
export function recordAuthorizationDenial({ ctx, required, mode, statusCode, reason }) {
  return recordAdminActivity({
    ctx,
    action: "authz.denied",
    permissions: asArray(required),
    result: "denied",
    statusCode,
    reason,
    metadata: { mode: mode || "all" },
  });
}
