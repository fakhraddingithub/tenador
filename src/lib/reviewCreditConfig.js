/**
 * src/lib/reviewCreditConfig.js
 *
 * خواننده‌ی سمت سرور برای تنظیمات پاداش نقدی نظر تأییدشده.
 * مقدار از SiteSetting (کلید review_credit_config) خوانده می‌شود؛ در صورت
 * نبودِ مقدار یا خطا، به تنظیمات پیش‌فرض (غیرفعال) برمی‌گردد تا چیزی نشکند.
 *
 * این فایل server-only است چون مدل Mongoose را ایمپورت می‌کند.
 */

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SiteSetting from "base/models/SiteSetting";
import {
  REVIEW_CREDIT_CONFIG_KEY,
  DEFAULT_REVIEW_CREDIT_CONFIG,
} from "@/lib/reviewCreditFinance";

export { REVIEW_CREDIT_CONFIG_KEY, DEFAULT_REVIEW_CREDIT_CONFIG };

/**
 * @returns {Promise<typeof DEFAULT_REVIEW_CREDIT_CONFIG>}
 */
export async function getReviewCreditConfig() {
  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({
      key: REVIEW_CREDIT_CONFIG_KEY,
    }).lean();
    if (!setting?.value) return DEFAULT_REVIEW_CREDIT_CONFIG;
    return { ...DEFAULT_REVIEW_CREDIT_CONFIG, ...setting.value };
  } catch (err) {
    console.error("getReviewCreditConfig error:", err);
    return DEFAULT_REVIEW_CREDIT_CONFIG;
  }
}
