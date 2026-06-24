/**
 * services/installmentService.js
 *
 * توابع کمکیِ مشترک برای سیستم اقساط — استفاده در API مشتری و ادمین.
 *
 * هیچ مقداری در دیتابیس تغییر نمی‌کند؛ این توابع فقط داده‌ی موجود را
 * «خلاصه» و «وضعیت مشتق‌شده» (مثل سررسیدگذشته) را محاسبه می‌کنند.
 *
 * منبع داده: مدل Installment (مبالغ تومان، چک‌ها با وضعیت PENDING/CLEARED/BOUNCED).
 */

/**
 * وضعیت نمایشیِ یک چک را برمی‌گرداند. اگر چک هنوز پرداخت نشده و تاریخ سررسیدش
 * گذشته باشد، وضعیت «OVERDUE» (سررسیدگذشته) مشتق می‌شود — این مقدار در دیتابیس
 * ذخیره نمی‌شود و فقط برای نمایش است.
 *
 * @param {Object} check
 * @param {Date}   [now=new Date()]
 * @returns {"PENDING"|"CLEARED"|"BOUNCED"|"OVERDUE"}
 */
export function deriveCheckStatus(check, now = new Date()) {
  if (!check) return "PENDING";
  if (check.status === "CLEARED" || check.status === "BOUNCED") {
    return check.status;
  }
  // PENDING — بررسی سررسید
  if (check.dueDate && new Date(check.dueDate).getTime() < now.getTime()) {
    return "OVERDUE";
  }
  return "PENDING";
}

/**
 * خلاصه‌ی یک سند اقساط: مبالغ پرداخت‌شده/باقی‌مانده، شمارش چک‌ها، سررسید بعدی،
 * تعداد چک‌های سررسیدگذشته و وضعیت کلیِ نمایشی.
 *
 * @param {Object} inst  - سند Installment به‌صورت lean (یا توسعه‌یافته با downPayment)
 * @param {Date}   [now=new Date()]
 */
export function summarizeInstallment(inst, now = new Date()) {
  const checks = Array.isArray(inst?.checks) ? inst.checks : [];

  const checksTotal = checks.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const clearedChecks = checks.filter((c) => c.status === "CLEARED");
  const clearedTotal = clearedChecks.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // مبلغ پیش‌پرداخت — اگر downPayment populate شده و تأیید شده باشد
  const downPaymentDoc = inst?.downPayment && typeof inst.downPayment === "object"
    ? inst.downPayment
    : null;
  const downPaymentAmount = Number(downPaymentDoc?.amount) || 0;
  const downPaymentPaid = downPaymentDoc?.status === "PAID";

  const paidChecksCount = clearedChecks.length;
  const remainingChecksCount = checks.filter((c) => c.status !== "CLEARED").length;

  // سررسید بعدی = نزدیک‌ترین چکِ پرداخت‌نشده
  const pendingDue = checks
    .filter((c) => c.status === "PENDING")
    .map((c) => c.dueDate)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b));
  const nextDueDate = pendingDue[0] || null;

  const overdueCount = checks.filter(
    (c) => deriveCheckStatus(c, now) === "OVERDUE"
  ).length;

  const anyBounced = checks.some((c) => c.status === "BOUNCED");
  const allCleared = checks.length > 0 && checks.every((c) => c.status === "CLEARED");

  // وضعیت نمایشیِ کلی (مشتق‌شده، مستقل از فیلد status ذخیره‌شده)
  let derivedStatus;
  if (allCleared) derivedStatus = "COMPLETED";
  else if (anyBounced) derivedStatus = "DEFAULTED";
  else if (overdueCount > 0) derivedStatus = "OVERDUE";
  else if (paidChecksCount > 0 || downPaymentPaid) derivedStatus = "ACTIVE";
  else derivedStatus = "PENDING";

  return {
    checksTotal,                                   // مجموع مبلغ چک‌ها (با سود)
    clearedTotal,                                  // مجموع چک‌های تأییدشده
    downPaymentAmount,
    downPaymentPaid,
    paidAmount: clearedTotal + (downPaymentPaid ? downPaymentAmount : 0),
    remainingAmount: checksTotal - clearedTotal,   // مانده‌ی چک‌ها
    paidChecksCount,
    remainingChecksCount,
    nextDueDate,
    overdueCount,
    derivedStatus,
  };
}
