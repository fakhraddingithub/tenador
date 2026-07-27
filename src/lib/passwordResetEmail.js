import crypto from "crypto";
import RateLimitHit from "base/models/RateLimitHit";

// مدت اعتبار کد ۵ رقمی + نشست بازیابی (مرحله ۱ تا ۳)
export const RESET_CODE_TTL_MS = 10 * 60 * 1000; // ۱۰ دقیقه
export const RESET_CODE_TTL_MINUTES = 10;

// حداقل فاصله‌ی زمانی مجاز بین دو ارسالِ کد (اعم از اولیه یا مجدد)
export const RESEND_COOLDOWN_MS = 45 * 1000;

// حداکثر تلاش نادرست برای وارد کردن کد پیش از الزام به درخواست کد جدید
export const MAX_VERIFY_ATTEMPTS = 5;

// کد ۵ رقمی (۱۰۰۰۰ تا ۹۹۹۹۹ — همیشه ۵ رقم)
export function generateResetCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// توکن نشست (opaque) که به کلاینت داده می‌شود؛ فقط هش آن در دیتابیس ذخیره می‌شود
export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ایمیل بدون حساسیت به حروف بزرگ/کوچک مقایسه می‌شود (اسکیمای User فیلد را lowercase نمی‌کند)
export function emailMatchQuery(email) {
  return { $regex: `^${escapeRegExp(email.trim())}$`, $options: "i" };
}

/**
 * محدودسازی نرخ عمومی بر اساس کلید دلخواه (مثلاً IP).
 * پیش از شمارش ایمیل معتبر/نامعتبر اجرا می‌شود تا هیچ تفاوتِ رفتاری‌ای بین
 * ایمیل موجود و ناموجود ایجاد نکند.
 */
export async function checkRateLimit(key, { max, windowMs }) {
  const since = new Date(Date.now() - windowMs);
  const count = await RateLimitHit.countDocuments({ key, createdAt: { $gte: since } });
  if (count >= max) return false;
  await RateLimitHit.create({ key });
  return true;
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
