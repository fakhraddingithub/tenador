/**
 * services/orderRecalc.js
 *
 * بازمحاسبه‌ی مبالغ تومانیِ یک سفارش پس از ویرایش ادمین (افزودن/حذف/تغییر تعداد آیتم).
 *
 * ⚠️ این فایل هیچ ارتباطی با priceEngine.js ندارد و آن را صدا نمی‌زند. وظیفه‌ی
 * آن صرفاً «جمع‌بستنِ» اسنپ‌شات‌های قیمتِ از پیش‌تأییدشده (item.unitPrice) است که
 * در زمان ثبت سفارش توسط computeCartPrice مینت شده‌اند. به این ترتیب هرگز قیمتِ
 * یک آیتمِ موجود را دوباره محاسبه نمی‌کنیم (که با تغییر نرخ/تخفیف‌ها drift ایجاد
 * می‌کرد)؛ فقط بر اساس همان اسنپ‌شات‌ها مجدداً جمع می‌زنیم.
 *
 * سیستم یورو (priceEUR / paymentsEUR) کاملاً مستقل است و اینجا هرگز لمس نمی‌شود.
 *
 * رابطه‌ی پایه (همان چیزی که checkout ذخیره می‌کند):
 *   Σ(unitPrice × qty)  =  subtotalPrice − discountAmount   (= «جمع پس از قوانین»)
 *   totalPrice          =  subtotalPrice − discountAmount − couponDiscount
 *                       =  Σ(unitPrice × qty) − couponDiscount
 */

/**
 * بازمحاسبه‌ی subtotalPrice / discountAmount / couponDiscount / totalPrice از روی
 * آرایه‌ی فعلیِ آیتم‌ها و کوپنِ ذخیره‌شده.
 *
 * رفتار کوپن: «نگه‌دار و محدود کن» — مقدار کوپنِ اصلی حفظ می‌شود ولی اگر از جمعِ
 * آیتم‌ها بیشتر شود (مثلاً بعد از حذف آیتم) به همان جمع clamp می‌شود تا مبلغ کل
 * هرگز منفی نشود و رابطه‌ی نمایشی (subtotal − discount − coupon = total) معتبر بماند.
 *
 * @param {Object} order  سند سفارش (Mongoose document یا lean) با items[] و couponDiscount
 * @returns {{ subtotalPrice:number, discountAmount:number, couponDiscount:number, totalPrice:number, itemsTotal:number }}
 */
export function recomputeOrderTotals(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  let itemsTotal = 0;     // Σ(unitPrice × qty) — جمعِ پس از تخفیف، قبل از کوپن
  let discountAmount = 0; // Σ(unitDiscount × qty)
  let subtotalPrice = 0;  // Σ((unitPrice + unitDiscount) × qty) = قبل از همه‌ی تخفیف‌ها

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
    const unitDiscount = Math.max(0, Number(it.unitDiscount) || 0);

    itemsTotal += unitPrice * qty;
    discountAmount += unitDiscount * qty;
    subtotalPrice += (unitPrice + unitDiscount) * qty;
  }

  const originalCoupon = Math.max(0, Number(order.couponDiscount) || 0);
  const couponDiscount = Math.min(originalCoupon, itemsTotal); // keep & clamp
  const totalPrice = Math.max(0, itemsTotal - couponDiscount);

  return { subtotalPrice, discountAmount, couponDiscount, totalPrice, itemsTotal };
}

/**
 * تعیین وضعیت پرداختِ تومانی از روی مجموع پرداخت‌های تأییدشده و مبلغ کل.
 * دقیقاً همان منطقِ مسیر تأیید پرداخت (approve route) را دنبال می‌کند.
 *
 * @param {number} totalPaid  مجموع amount پرداخت‌های PAID
 * @param {number} totalPrice مبلغ کل سفارش
 * @returns {"UNPAID"|"PARTIALLY_PAID"|"PAID"}
 */
export function derivePaymentStatus(totalPaid, totalPrice) {
  const paid = Math.max(0, Number(totalPaid) || 0);
  const total = Math.max(0, Number(totalPrice) || 0);
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIALLY_PAID";
}
