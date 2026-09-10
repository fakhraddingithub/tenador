/**
 * src/lib/reviewCreditConfig.js
 *
 * خواننده‌ی سمت سرور برای تنظیمات پاداش نقدی نظر تأییدشده.
 * مقدار از SiteSetting (کلید review_credit_config) خوانده می‌شود؛ در صورت
 * نبود مقدار، پیش‌فرض غیرفعال است. خطای خواندن نباید با غیرفعال بودن اشتباه شود.
 *
 * این فایل server-only است چون مدل Mongoose را ایمپورت می‌کند.
 */

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SiteSetting from "base/models/SiteSetting";
import {
  REVIEW_CREDIT_CONFIG_KEY,
  DEFAULT_REVIEW_CREDIT_CONFIG,
  validateReviewCreditConfig,
} from "@/lib/reviewCreditFinance";

export { REVIEW_CREDIT_CONFIG_KEY, DEFAULT_REVIEW_CREDIT_CONFIG };

/**
 * @returns {Promise<typeof DEFAULT_REVIEW_CREDIT_CONFIG>}
 */
export async function getReviewCreditConfig(session = null) {
  await connectToDB();
  const setting = await SiteSetting.findOne({ key: REVIEW_CREDIT_CONFIG_KEY })
    .session(session).lean();
  if (!setting?.value) return { ...DEFAULT_REVIEW_CREDIT_CONFIG };
  const isObject = typeof setting.value === "object" && !Array.isArray(setting.value);
  const config = isObject ? { ...DEFAULT_REVIEW_CREDIT_CONFIG, ...setting.value } : null;
  const message = validateReviewCreditConfig(config);
  if (message) {
    const error = new Error(message);
    error.code = "INVALID_REVIEW_CREDIT_CONFIG";
    throw error;
  }
  return config;
}
