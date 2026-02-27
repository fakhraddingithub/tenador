import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import { ExchangeRate } from "base/models/ExchangeRate";

/**
 * نرخ تبدیل کش‌شده — revalidate هر ۱۰ دقیقه یا با تگ "exchange-rate"
 * در سمت سرور استفاده میشه
 */
export const getCachedRate = unstable_cache(
  async () => {
    await connectToDB();
    const doc = await ExchangeRate.findOne({ currency: "EUR" }).lean();
    return doc?.rateToToman ?? null;
  },
  ["exchange-rate"],
  { revalidate: 600, tags: ["exchange-rate"] }
);

/**
 * تبدیل یورو به تومان
 * @param {number} eurPrice - قیمت به یورو
 * @param {number} rate     - نرخ تبدیل (از getCachedRate)
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