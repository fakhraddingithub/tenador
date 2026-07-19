/**
 * utils/ticketMeta.js
 *
 * منبع واحدِ مقادیر و برچسب‌های فارسیِ سیستم تیکت پشتیبانی.
 * بدون هیچ وابستگی (نه mongoose، نه react) تا هم در مدل‌ها/روت‌های سرور و هم
 * در کامپوننت‌های کلاینتِ هر دو پنل (ادمین و داشبورد کاربر) قابل استفاده باشد.
 * آیکون‌ها و رنگ‌ها عمداً اینجا نیستند — هر پنل سیستم بصری خودش را دارد.
 */

// ─── دپارتمان‌ها ─────────────────────────────────────────────────────────
export const TICKET_DEPARTMENTS = [
  "sales",
  "support",
  "followup",
  "consultation",
  "technical",
  "returns",
  "billing",
];

export const DEPARTMENT_LABELS = {
  sales: "فروش",
  support: "پشتیبانی",
  followup: "پیگیری",
  consultation: "مشاوره",
  technical: "فنی",
  returns: "مرجوعی و بازگشت وجه",
  billing: "مالی",
};

// ─── اولویت‌ها ───────────────────────────────────────────────────────────
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"];

export const PRIORITY_LABELS = {
  low: "کم",
  medium: "متوسط",
  high: "بالا",
  urgent: "فوری",
};

// ─── وضعیت‌ها ────────────────────────────────────────────────────────────
// open         = در انتظار پاسخ پشتیبانی (تیکت جدید یا پیام جدید کاربر)
// answered     = پشتیبانی پاسخ داده است
// pending_user = در انتظار پاسخ/اطلاعات تکمیلی از کاربر
// closed       = بسته‌شده (تاریخچه همیشه قابل مشاهده می‌ماند)
export const TICKET_STATUSES = ["open", "answered", "pending_user", "closed"];

export const STATUS_LABELS = {
  open: "در انتظار پاسخ",
  answered: "پاسخ داده شده",
  pending_user: "در انتظار پاسخ کاربر",
  closed: "بسته شده",
};

// برچسبِ وضعیت از دیدِ کاربر (pending_user یعنی منتظرِ خودِ اوست)
export const STATUS_LABELS_USER = {
  ...STATUS_LABELS,
  pending_user: "در انتظار پاسخ شما",
};
