/**
 * یکسان‌سازیِ کاراکترهای فارسی/عربیِ هم‌شکل برای مقایسه — نه برای نمایش.
 * خروجی این تابع فقط باید برای تشخیصِ «برابری» یا «شاملیت» استفاده شود، هرگز
 * برای ذخیره یا نمایش به کاربر (چون معنایی/املایی تغییر می‌کند، فقط برای مقایسه امن است).
 */
export function normalizeForCompare(value) {
  return String(value ?? "")
    .replace(/\u064A/g, "\u06CC") // ي (عربی) → ی (فارسی)
    .replace(/\u0643/g, "\u06A9") // ك (عربی) → ک (فارسی)
    .replace(/[\u200C\u200B\uFEFF]/g, " ") // نیم‌فاصله/ZWSP/BOM → فاصله‌ی معمولی (فقط برای مقایسه)
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLenientPersianRegexSource(escapedSource) {
  return escapedSource
    .replace(/\u064A|\u06CC/g, "[\\u064A\\u06CC]")
    .replace(/\u0643|\u06A9/g, "[\\u0643\\u06A9]");
}
