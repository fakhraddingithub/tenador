/**
 * src/lib/racketMatch/resultPayload.js
 *
 * ساختِ خروجیِ نهاییِ سه نتیجه.
 *
 * چرا جدا از مسیرِ API؟ چون باگِ «نمایش سریعِ ناقص» دقیقاً همین‌جا بود: نتیجه‌ها
 * از یک شیءِ خلاصه‌شده (فقط فیلدهای کارت) ساخته می‌شدند، در حالی که مودالِ نمایش
 * سریع به همان شکلِ کاملی نیاز دارد که صفحهٔ دسته‌بندی به آن می‌دهد. حالا پایهٔ
 * ادغام، محصولِ کاملِ دیتابیس است و فیلدهای تطبیق فقط رویش می‌نشینند.
 */

/**
 * فیلدهایی که مودالِ نمایش سریع (QuickViewModal) و کارت محصول واقعاً می‌خوانند —
 * مستقیم یا از طریقِ کمکی‌های variantImages. اگر روزی یکی از این‌ها از خروجی
 * بیفتد، تستِ tests/racketQuickView.test.mjs می‌ترکد.
 */
export const QUICK_VIEW_REQUIRED_FIELDS = Object.freeze([
  "_id",
  "name",
  "slug",
  "mainImage",
  "gallery",
  "shortDescription",
  "basePrice",
  "brand",
  "category",
  "attributes",
  "variantMeta",
  "variants",
]);

/**
 * ادغامِ یک نتیجهٔ رتبه‌بندی‌شده با دادهٔ نمایشیِ کاملِ همان محصول.
 *
 * @param {Object|null} item نتیجهٔ موتور (سبک: specs/match/rank/explanation/tradeoff)
 * @param {Map<string, Object>} display نگاشتِ شناسه به محصولِ کاملِ قیمت‌خورده
 * @param {Array} fallbackVariantAttributes ویژگی‌های واریانتِ دسته، برای حالتِ نادرِ نبودِ محصول
 */
export function mergeRankedWithDisplay(item, display, fallbackVariantAttributes = []) {
  if (!item) return null;

  const full = display?.get?.(item._id);

  // محصول بین ساختِ کشِ امتیازدهی و این کوئری غیرفعال/حذف شده است. نتیجه را
  // دور نمی‌اندازیم؛ با همان دادهٔ سبک برمی‌گردانیم تا کاربر سه پیشنهاد ببیند.
  if (!full) {
    return { ...item, category: { variantAttributes: fallbackVariantAttributes } };
  }

  return {
    ...full,
    _id: item._id,
    specs: item.specs,
    match: item.match,
    rank: item.rank,
    explanation: item.explanation,
    ...(item.tradeoff ? { tradeoff: item.tradeoff } : {}),
  };
}

/** فیلدهایی از خروجی که خالی/غایب‌اند — برای تست و عیب‌یابی */
export function missingQuickViewFields(product) {
  return QUICK_VIEW_REQUIRED_FIELDS.filter((field) => {
    const value = product?.[field];
    if (value === undefined || value === null) return true;
    // آرایه یا رشتهٔ خالی هم یعنی مودال چیزی برای نشان دادن ندارد
    if (Array.isArray(value)) return false;
    if (typeof value === "string") return value.trim() === "";
    return false;
  });
}
