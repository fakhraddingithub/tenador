/**
 * utils/brandCollaboration.js
 *
 * دامنه‌ی «همکاری» روی صفحه‌ی برند مهمان.
 *
 * قاعده‌ی واحد: محصولاتِ یک لیمیتد ادیشن، محصولاتِ «برند مالکِ» همان ادیشن‌اند —
 * دقیقاً همان چیزی که مسیر /[brand]/[limitedEdition] در query.service.js اعمال
 * می‌کند ({ brand: brand._id, limitedEdition: limitedEdition._id }).
 *
 * چرا این قید لازم است: مدلِ قبلی (models/Collaboration.js) «سراسری» بود و به هیچ
 * برندی وابسته نبود، پس محصولاتِ برندهای بی‌ربط هم می‌توانستند تگِ یک همکاری را
 * بگیرند. آن ردیف‌های قدیمی هنوز در دیتابیس هستند؛ اگر دامنه‌ی همکاری «هر برندی
 * به‌جز برندِ همین صفحه» باشد، همان تگ‌های اشتباه روی صفحه‌ی برند مهمان بیرون
 * می‌زنند (مثلاً ساک‌های تکنیفایبر زیر «ویلسون × رولان گاروس»).
 */

/**
 * از روی لیمیتد ادیشن‌هایی که این برند را در relatedBrands دارند، جفتِ
 * «ادیشن ← برند مالک» را می‌سازد.
 *
 * @param {Array} relatedEditions اسناد LimitedEdition با brand پرشده یا خام
 * @param {string} guestBrandId برندی که صفحه‌اش در حال رندر است
 * @returns {Array<{ editionId: string, ownerBrandId: string }>}
 */
export function buildCollaborationScopes(relatedEditions, guestBrandId) {
  const guest = guestBrandId == null ? "" : String(guestBrandId);
  const seen = new Set();
  const scopes = [];

  for (const edition of Array.isArray(relatedEditions) ? relatedEditions : []) {
    const editionId = edition?._id == null ? "" : String(edition._id);
    const owner = edition?.brand?._id ?? edition?.brand;
    const ownerBrandId = owner == null ? "" : String(owner);

    // بدون مالک → همکاری‌ای در کار نیست. مالک == خودِ این برند → محصولاتش از
    // مسیرِ عادیِ سری/سایرِ همین برند می‌آیند و نباید دوباره شمرده شوند.
    if (!editionId || !ownerBrandId || ownerBrandId === guest) continue;
    if (seen.has(editionId)) continue;

    seen.add(editionId);
    scopes.push({ editionId, ownerBrandId });
  }

  return scopes;
}

/**
 * برای هر ادیشن یک شاخه‌ی مستقلِ match می‌سازد. جدا نگه‌داشتنِ شاخه‌ها (به‌جای
 * { brand: { $in: owners }, limitedEdition: { $in: editions } }) جلوی تطبیقِ
 * ضربدریِ «مالکِ A + ادیشنِ B» را وقتی چند همکاری هم‌زمان هست می‌گیرد.
 *
 * @param {Array<{ editionId: string, ownerBrandId: string }>} scopes
 * @param {(value: string) => unknown} toObjectId
 */
export function collaborationMatchBranches(scopes, toObjectId) {
  return (Array.isArray(scopes) ? scopes : [])
    .map(({ editionId, ownerBrandId }) => ({
      brand: toObjectId(ownerBrandId),
      limitedEdition: toObjectId(editionId),
    }))
    .filter((branch) => branch.brand && branch.limitedEdition);
}
