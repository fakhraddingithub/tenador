/**
 * src/lib/apiClientError.js  (client)
 *
 * استخراجِ پیامِ خطای قابل‌نمایش از پاسخِ API. با قراردادِ handleApiError سمت
 * سرور هماهنگ است: { error, fieldErrors? }. اگر چند خطای فیلد وجود داشته باشد،
 * همه به‌صورت خوانا به‌هم می‌چسبند.
 *
 * نمونه:
 *   const res = await fetch(...);
 *   const data = await res.json().catch(() => ({}));
 *   if (!res.ok) showToast.error(getApiErrorMessage(data, "خطا در ذخیره"));
 */
export function getApiErrorMessage(data, fallback = "خطای غیرمنتظره رخ داد") {
  if (!data || typeof data !== "object") return fallback;

  // چند خطای فیلد → همه را نشان بده (پیامِ اصلی معمولاً همان اولی است)
  const fieldErrors = data.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const msgs = [...new Set(Object.values(fieldErrors).filter(Boolean))];
    if (msgs.length > 1) return msgs.join("\n");
    if (msgs.length === 1) return msgs[0];
  }

  return data.error || data.message || fallback;
}
