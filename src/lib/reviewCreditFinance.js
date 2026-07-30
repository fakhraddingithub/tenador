/**
 * src/lib/reviewCreditFinance.js
 *
 * ثابت‌های تنظیمات پاداش نقدی نظر. این ماژول خالص (pure) است و هیچ ایمپورت
 * server-only ندارد، بنابراین هم در کامپوننت پنل ادمین و هم در روت‌های
 * API/سرویس‌های سرور استفاده می‌شود (همان الگوی installmentFinance.js).
 */

export const REVIEW_CREDIT_CONFIG_KEY = "review_credit_config";

export const REVIEW_CREDIT_ROLE_OPTIONS = [
  { value: "user", label: "کاربر عادی" },
  { value: "coach", label: "مربی" },
  { value: "seller", label: "فروشنده" },
  { value: "national_player", label: "ورزشکار ملی" },
  { value: "store", label: "فروشگاه" },
];

export const DEFAULT_REVIEW_CREDIT_CONFIG = {
  enabled: false,
  kind: "amount", // "amount" | "percent"
  value: 0,
  eligibleRoles: [],
  granularity: "per-item", // "per-item" | "per-order"
};
