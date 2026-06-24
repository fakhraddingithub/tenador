// src/components/admin/analytics/format.js
// قالب‌بندی‌ها و توکن‌های رنگیِ مشترکِ داشبورد تحلیل (خالص — بدون وابستگی)

export const fa = (n) => new Intl.NumberFormat("fa-IR").format(Math.round(Number(n ?? 0)));

// مبلغ فشرده‌ی تومانی (هزار/میلیون/میلیارد) برای محورها و کارت‌ها
export function compactToman(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیارد`;
  if (abs >= 1e6) return `${(v / 1e6).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیون`;
  if (abs >= 1e3) return `${(v / 1e3).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} هزار`;
  return fa(v);
}

// نسخه‌ی کوتاهِ محور (بدون واحد فارسی، برای تیک‌ها)
export function axisShort(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
}

export const pct = (n) => `${Number(n ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;

export function faDate(d, withTime = false) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      timeZone: "Asia/Tehran",
    }).format(new Date(d));
  } catch {
    return "—";
  }
}

// برچسبِ کوتاهِ ماه/روز برای محور نمودار
export function faDayLabel(isoDate) {
  if (!isoDate) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function faMonthLabel(ym) {
  // ym = "YYYY-MM"
  if (!ym) return "";
  try {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat("fa-IR", { year: "2-digit", month: "short", timeZone: "Asia/Tehran" }).format(new Date(y, m - 1, 15));
  } catch {
    return ym;
  }
}

// روزهای هفته بر اساس خروجی $dayOfWeek مونگو (1=یکشنبه ... 7=شنبه)
export const WEEKDAYS = {
  7: "شنبه", 1: "یکشنبه", 2: "دوشنبه", 3: "سه‌شنبه", 4: "چهارشنبه", 5: "پنجشنبه", 6: "جمعه",
};
// ترتیب نمایشِ هفته‌ی شمسی
export const WEEKDAY_ORDER = [7, 1, 2, 3, 4, 5, 6];

// پالت رنگ برند + رنگ‌های دسته‌ای
export const COLORS = {
  primary: "#aa4725",
  secondary: "#ffbf00",
  ink: "#0d0d0d",
  green: "#16a34a",
  red: "#dc2626",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#7c3aed",
  teal: "#0d9488",
};

export const CATEGORICAL = [
  "#aa4725", "#ffbf00", "#3b82f6", "#16a34a", "#7c3aed",
  "#0d9488", "#f59e0b", "#dc2626", "#0ea5e9", "#db2777",
];

// سطل‌های سنیِ مطالبات
export const AGING_LABELS = {
  current: "سررسید نشده",
  d0_30: "۰ تا ۳۰ روز",
  d31_60: "۳۱ تا ۶۰ روز",
  d61_90: "۶۱ تا ۹۰ روز",
  d90_plus: "بیش از ۹۰ روز",
};

export const AGING_COLORS = {
  current: "#16a34a",
  d0_30: "#84cc16",
  d31_60: "#f59e0b",
  d61_90: "#f97316",
  d90_plus: "#dc2626",
};
