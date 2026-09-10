/**
 * src/lib/reviewCreditFinance.js
 *
 * ثابت‌های تنظیمات پاداش نقدی نظر. این ماژول خالص (pure) است و هیچ ایمپورت
 * server-only ندارد، بنابراین هم در کامپوننت پنل ادمین و هم در روت‌های
 * API/سرویس‌های سرور استفاده می‌شود (همان الگوی installmentFinance.js).
 */

export const REVIEW_CREDIT_CONFIG_KEY = "review_credit_config";

// نقشِ «فروشنده» (seller) حذف شده — با «فروشگاه» (store) اضافی بود.
export const REVIEW_CREDIT_ROLE_OPTIONS = [
  { value: "user", label: "کاربر عادی" },
  { value: "coach", label: "مربی" },
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

// SiteSetting.value is Mixed, so validate on the server as well as in the form.
export function validateReviewCreditConfig(value) {
  const roles = REVIEW_CREDIT_ROLE_OPTIONS.map((role) => role.value);
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      typeof value.enabled !== "boolean" ||
      !["amount", "percent"].includes(value.kind) ||
      !["per-item", "per-order"].includes(value.granularity) ||
      typeof value.value !== "number" || !Number.isFinite(value.value) ||
      value.value < 0 || value.value > Number.MAX_SAFE_INTEGER ||
      (value.kind === "percent" && value.value > 100) ||
      !Array.isArray(value.eligibleRoles) ||
      value.eligibleRoles.some((role) => !roles.includes(role)) ||
      (value.enabled && value.eligibleRoles.length === 0)) {
    return "تنظیمات پاداش نظر نامعتبر است؛ مبلغ، درصد و نقش‌های مجاز را بررسی کنید";
  }
  return null;
}
