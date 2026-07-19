/**
 * src/lib/ticketUtils.js
 *
 * کمک‌تابع‌های مشترک روت‌های تیکت (کاربر + ادمین).
 */

/**
 * پاک‌سازی آرایه‌ی پیوست‌های ارسالی از کلاینت.
 * فقط خروجیِ مکانیزم آپلود موجود (POST /api/upload) پذیرفته می‌شود:
 * url رشته‌ای، نوع image یا pdf، و متادیتای nam/size اختیاری.
 */
export function sanitizeAttachments(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a) => a && typeof a.url === "string" && a.url.trim())
    .slice(0, 6) // سقف منطقی برای هر پیام
    .map((a) => ({
      url: a.url.trim(),
      type: a.type === "pdf" ? "pdf" : "image",
      filename: typeof a.filename === "string" ? a.filename.slice(0, 200) : "",
      size: Number.isFinite(Number(a.size)) ? Number(a.size) : 0,
    }));
}
