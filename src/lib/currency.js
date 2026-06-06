/**
 * src/lib/currency.js
 *
 * توابع خالص تبدیل و فرمت ارز — بدون هیچ وابستگی سروری (mongoose/next-cache).
 * امن برای import در کامپوننت‌های client و server.
 */

/**
 * تبدیل یورو به تومان
 * @param {number} eurPrice - قیمت به یورو
 * @param {number} rate     - نرخ تبدیل
 * @returns {number}
 */
export function eurToToman(eurPrice, rate) {
  if (!rate || !eurPrice) return 0;
  const rawToman = Math.round(Number(eurPrice) * rate);
  return Math.floor(rawToman / 1000) * 1000;
}

/**
 * فرمت قیمت تومان برای نمایش
 * @param {number} toman
 * @returns {string}
 */
export function formatToman(toman) {
  return Number(toman).toLocaleString("fa-IR");
}

/**
 * تبدیل و فرمت یکجا
 */
export function convertAndFormat(eurPrice, rate) {
  return formatToman(eurToToman(eurPrice, rate));
}
