/**
 * src/lib/auditRedaction.js
 *
 * حذفِ اسرار پیش از هر نوشتنِ ممیزی — تنها منبعِ «چه چیزی هرگز ثبت نمی‌شود».
 *
 * تا فاز ۶ این کد داخل adminActivity.js بود. با آمدنِ پلاگینِ Mongoose دو
 * نویسنده پیدا کرد، و دو نسخه‌ی فهرستِ اسرار یعنی یکی از آن دو روزی عقب
 * می‌ماند. اینجا هیچ ایمپورتی وجود ندارد تا هم لایه‌ی مدل و هم لایه‌ی سرویس
 * بتوانند بارش کنند. adminActivity.js همه‌ی این نام‌ها را دوباره export
 * می‌کند، پس فراخوان‌های قدیمی دست‌نخورده‌اند.
 */

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
export const PRIVATE_DOCUMENT = "[سندِ خصوصی]";

const normalizeFieldName = (name) => String(name).toLowerCase().replace(/[_-]/g, "");

export function isSecretField(name) {
  return SECRET_FIELDS.has(normalizeFieldName(name));
}

export function isPrivateUrlField(name) {
  return PRIVATE_URL_FIELDS.has(normalizeFieldName(name));
}

/**
 * آیا این *مسیرِ* نقطه‌دار به فیلدی حساس ختم می‌شود؟
 *
 * تفاوتش با isSecretField این است که `bankReceipt.cardNumber` را هم می‌گیرد:
 * پلاگینِ Mongoose تفاوت‌ها را با مسیرِ کامل می‌سازد، نه با نامِ تک‌بخشی.
 */
export function isSecretPath(path) {
  return String(path)
    .split(".")
    .some((segment) => isSecretField(segment));
}

export function isPrivateUrlPath(path) {
  return String(path)
    .split(".")
    .some((segment) => isPrivateUrlField(segment));
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
      else if (isPrivateUrlField(key)) out[key] = item ? PRIVATE_DOCUMENT : null;
      else out[key] = redact(item, depth + 1);
    }
    return out;
  }

  return null;
}
