import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import { ExchangeRate } from "base/models/ExchangeRate";

// توابع خالص فرمت/تبدیل از ماژول client-safe دوباره export می‌شوند
// تا importهای سروریِ موجود بدون تغییر کار کنند.
// ⚠️ کامپوننت‌های client باید مستقیماً از "@/lib/currency" import کنند،
// چون این فایل getCachedRate (وابسته به mongoose/next-cache) را هم دارد.
export { eurToToman, formatToman, convertAndFormat } from "@/lib/currency";

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