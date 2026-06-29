/**
 * src/lib/installmentRateService.js
 *
 * خواننده‌ی سمت سرور برای نرخ سود ماهانه‌ی سراسری اقساط (Part 1).
 * مقدار از SiteSetting (کلید monthly_installment_rate) خوانده می‌شود؛ در صورت
 * نبودِ مقدار یا خطا، به نرخ پیش‌فرض برمی‌گردد تا چیزی نشکند (Safe Fetching).
 *
 * این فایل server-only است چون مدل Mongoose را ایمپورت می‌کند؛ آن را در
 * کامپوننت‌های کلاینت ایمپورت نکنید (کلاینت از /api/installment-rate استفاده کند).
 */

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SiteSetting from "base/models/SiteSetting";
import {
  INSTALLMENT_RATE_KEY,
  DEFAULT_MONTHLY_RATE,
} from "@/lib/installmentFinance";

/**
 * نرخ سود ماهانه‌ی فعلی (درصد). همیشه یک عدد معتبر برمی‌گرداند.
 * @returns {Promise<number>}
 */
export async function getMonthlyInstallmentRate() {
  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key: INSTALLMENT_RATE_KEY }).lean();
    const val = Number(setting?.value);
    return Number.isFinite(val) && val >= 0 ? val : DEFAULT_MONTHLY_RATE;
  } catch (err) {
    console.error("getMonthlyInstallmentRate error:", err);
    return DEFAULT_MONTHLY_RATE;
  }
}
