/**
 * services/orderEurRecalc.js
 *
 * بازمحاسبه‌ی «مبلغ کلِ یورویی سفارش» (order.priceEUR) از روی قیمت‌های یورویی
 * اقلام (order.items[].priceEUR).
 *
 * ⚠️ این ماژول کاملاً مستقل از سیستم تومان است و هیچ فیلد تومانی
 * (unitPrice / subtotalPrice / discountAmount / couponDiscount / totalPrice /
 * paymentStatus) را نمی‌خواند و نمی‌نویسد. متقابلاً services/orderRecalc.js
 * (سیستم تومان) هرگز فیلدهای یورویی را لمس نمی‌کند.
 *
 * تعریف‌ها:
 *   items[].priceEUR = قیمت **واحد** به یورو، دستی توسط ادمین (نه قیمت محصول).
 *   سهم هر قلم        = priceEUR × quantity   (هم‌ارزِ unitPrice تومانی)
 *   مبلغ کل یورو      = Σ سهمِ اقلامی که priceEUR دارند
 *
 * قاعده‌ی ایمنیِ سازگاری با گذشته (مهم‌ترین نکته‌ی این فایل):
 *   اگر **هیچ** قلمی قیمت یورویی نداشته باشد، order.priceEUR اصلاً لمس نمی‌شود.
 *   یعنی سفارش‌های قدیمی (که فقط یک مبلغ کلِ یورویی دستی دارند) هرگز به صفر
 *   یا null بازنویسی نمی‌شوند. مبلغ کل فقط وقتی خودکار عوض می‌شود که دست‌کم یک
 *   قلم قیمت یورویی داشته باشد — یعنی دقیقاً وقتی ادمین آگاهانه از قیمت‌گذاری
 *   یوروییِ سطحِ قلم استفاده کرده است.
 */

/** آیا مقدار یک قیمت یورویی معتبرِ ثبت‌شده است؟ (null/undefined/NaN = تعیین‌نشده) */
export function hasItemEur(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/**
 * جمعِ قیمت‌های یورویی اقلام.
 *
 * @param {Array<{ priceEUR?: number|null, quantity?: number }>} items
 * @returns {{ hasAny: boolean, sum: number, count: number }}
 *   hasAny = آیا دست‌کم یک قلم قیمت یورویی دارد (تصمیم‌گیرِ «بازمحاسبه بکنیم یا نه»)
 *   sum    = Σ(priceEUR × quantity) روی همان اقلام
 */
export function sumItemsEUR(items) {
  const list = Array.isArray(items) ? items : [];
  let sum = 0;
  let count = 0;

  for (const it of list) {
    if (!hasItemEur(it?.priceEUR)) continue;
    const price = Math.max(0, Number(it.priceEUR));
    const qty = Math.max(1, Math.floor(Number(it?.quantity)) || 1);
    sum += price * qty;
    count += 1;
  }

  // گِرد کردن به دو رقم اعشار — یورو ارزِ اعشاری است و جمعِ اعداد اعشاری در
  // ممیز شناور دُم می‌سازد (0.1 + 0.2). بدون این، مبلغ کل مثل 100.00000000000001 می‌شد.
  return { hasAny: count > 0, sum: Math.round(sum * 100) / 100, count };
}

/**
 * مبلغ کلِ یورویی‌ای که باید ذخیره شود را برمی‌گرداند.
 *
 * @param {Array} items          اقلامِ سفارش (پس از اعمالِ تغییرِ جاری)
 * @param {number|null} current  مبلغ کلِ یورویی فعلیِ سفارش
 * @returns {number|null} مقدارِ جدید؛ اگر هیچ قلمی قیمت یورویی ندارد همان `current`
 *                        برگردانده می‌شود (یعنی «دست نزن»).
 */
export function resolveOrderEurTotal(items, current) {
  const { hasAny, sum } = sumItemsEUR(items);
  if (!hasAny) return current ?? null;
  return sum;
}

/**
 * همان منطق، ولی اعمال‌شده روی یک سندِ Mongoose (یا شیء ساده) — در جاهایی که
 * سند با order.save() ذخیره می‌شود.
 *
 * @param {Object} order سندِ سفارش با items[] و priceEUR
 * @returns {boolean} آیا مقدار عوض شد (برای لاگ/تصمیمِ فراخوان)
 */
export function applyOrderEurTotal(order) {
  const next = resolveOrderEurTotal(order?.items, order?.priceEUR ?? null);
  const prev = order?.priceEUR ?? null;
  if (next === prev) return false;
  order.priceEUR = next;
  return true;
}
