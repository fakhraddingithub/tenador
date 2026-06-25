// base/utils/discountMatch.js
//
// تک‌منبعِ منطقِ «زیرفیلتر برند» برای قوانین تخفیفِ نوع category.
// هر جایی که قوانین DiscountRule روی یک محصول ارزیابی می‌شوند باید از این
// تابع استفاده کند تا منطق فقط در یک نقطه نگه‌داری شود.

/**
 * آیا قانونِ category با توجه به زیرفیلترِ برند روی این محصول اعمال می‌شود؟
 *
 * یک قانون category که `targetBrands` دارد فقط روی محصولاتی اعمال می‌شود که
 * برندشان در آن لیست باشد (مثلاً «راکت‌های ویلسون» = دسته راکت + برند ویلسون).
 *
 *  - نوعِ غیر از category            → همیشه true (این فیلتر فقط برای category معنا دارد)
 *  - targetBrands خالی/تعریف‌نشده    → true (سازگاری با گذشته: همه‌ی برندهای آن دسته)
 *  - targetBrands پر                 → فقط اگر برندِ محصول در لیست باشد
 *
 * این تابع *فقط* زیرفیلترِ برند را بررسی می‌کند؛ تطبیقِ خودِ دسته (targets شامل
 * categoryId) باید جداگانه و قبل از این بررسی انجام شده باشد.
 *
 * @param {Object} rule        سند DiscountRule (lean) — باید type و targetBrands داشته باشد
 * @param {*} brandId          شناسه‌ی برندِ محصول (ObjectId | string | {_id})
 * @returns {boolean}
 */
export function ruleBrandFilterPasses(rule, brandId) {
  if (!rule || rule.type !== "category") return true;

  const targetBrands = Array.isArray(rule.targetBrands) ? rule.targetBrands : [];
  if (targetBrands.length === 0) return true;

  const bid = (brandId?._id ?? brandId)?.toString();
  if (!bid) return false;

  return targetBrands.some((b) => b?.toString() === bid);
}
