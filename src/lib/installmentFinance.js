/**
 * src/lib/installmentFinance.js
 *
 * منبع واحد محاسبات اقساط (Iranian bazaar «فروش اقساطی» — سود ساده/مرابحه‌ای).
 * این ماژول خالص (pure) است و هیچ ایمپورت server-only ندارد، بنابراین هم در
 * کامپوننت‌های کلاینت (ماشین‌حساب اقساط) و هم در روت‌های API استفاده می‌شود.
 *
 * مدل ریاضی (سود ساده روی کل اصل برای کل دوره):
 *   r = i / 100                      نرخ ماهانه به صورت اعشاری
 *   totalInterest = P × r × n        کل سود دریافتی
 *   grandTotal    = P + totalInterest = P × (1 + r·n)
 *   monthly       = grandTotal / n   مبلغ هر قسط
 */

export const INSTALLMENT_RATE_KEY = "monthly_installment_rate";

/** نرخ سود ماهانه‌ی پیش‌فرض (٪) اگر در تنظیمات سایت چیزی ذخیره نشده باشد. */
export const DEFAULT_MONTHLY_RATE = 4;

/** فقط ارقام را نگه می‌دارد (برای ورودی‌های متنی). */
export function digitsOnly(str) {
  return String(str ?? "").replace(/[^0-9]/g, "");
}

/**
 * قالب‌بندی سه‌رقمی با کاما (سبک غربی): 12000000 → "12,000,000".
 * ارقام انگلیسی نگه داشته می‌شوند چون خواسته‌ی صریح، جداکننده‌ی کاما است.
 */
export function formatThousands(value) {
  const d = digitsOnly(value);
  if (!d) return "";
  // حذف صفرهای ابتدایی اضافه (به جز خود صفر)
  const normalized = d.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** رشته‌ی دارای کاما/ارقام → عدد خالص. "12,000,000" → 12000000 */
export function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const d = digitsOnly(value);
  return d ? Number(d) : 0;
}

/** قالب‌بندی یک عدد به رشته‌ی سه‌رقمی با کاما. 2480000 → "2,480,000" */
export function formatNumber(num) {
  const n = Math.round(Number(num) || 0);
  return n.toLocaleString("en-US");
}

/**
 * هسته‌ی محاسبه‌ی طرح اقساطی.
 * @param {Object} opts
 * @param {number|string} opts.principal  اصل مبلغ (تومان)
 * @param {number|string} opts.monthlyRatePct  نرخ سود ماهانه (٪)
 * @param {number|string} opts.months  تعداد اقساط
 * @returns {{principal:number, monthlyRatePct:number, months:number,
 *            totalInterest:number, grandTotal:number, monthlyInstallment:number, valid:boolean}}
 */
export function computeInstallmentPlan({ principal, monthlyRatePct, months }) {
  const P = parseAmount(principal);
  const i = Number(String(monthlyRatePct).replace(/,/g, "")) || 0;
  const n = Math.trunc(parseAmount(months));

  const valid = P > 0 && i >= 0 && n >= 1;

  const r = i / 100;
  const totalInterest = valid ? P * r * n : 0;
  const grandTotal = valid ? P + totalInterest : 0;
  const monthlyInstallment = valid ? Math.round(grandTotal / n) : 0;

  return {
    principal: P,
    monthlyRatePct: i,
    months: n,
    totalInterest: Math.round(totalInterest),
    grandTotal: Math.round(grandTotal),
    monthlyInstallment,
    valid,
  };
}

/**
 * مانده‌ی قابل پرداخت یک طرح اقساطی بر اساس نرخ سود ماهانه‌ی ذخیره‌شده.
 * منطق بک‌اند (Part 1.4): جمع کل با احتساب سود − مبالغ چک‌های تسویه‌شده (CLEARED).
 *
 * @param {{totalAmount:number, numberOfChecks:number, checks?:Array}} installment
 * @param {number} monthlyRatePct نرخ سود ماهانه (٪)
 */
export function computeRemainingDue(installment, monthlyRatePct) {
  const principal = parseAmount(installment?.totalAmount);
  const months = Math.trunc(parseAmount(installment?.numberOfChecks)) || 1;

  const plan = computeInstallmentPlan({ principal, monthlyRatePct, months });

  const paid = (installment?.checks || [])
    .filter((c) => c?.status === "CLEARED")
    .reduce((sum, c) => sum + parseAmount(c.amount), 0);

  const remainingDue = Math.max(0, plan.grandTotal - paid);

  return {
    ...plan,
    paid: Math.round(paid),
    remainingDue: Math.round(remainingDue),
  };
}
