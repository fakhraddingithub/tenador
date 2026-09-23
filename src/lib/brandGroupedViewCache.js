// Cacheِ کوتاه‌عمرِ داخل همان اجرای مرورگر برای وضعیت کامل صفحه‌های برند.
// عمداً از sessionStorage/localStorage استفاده نمی‌شود: payload محصولات ممکن است
// بزرگ شود و نوشتن/خواندن هم‌زمانِ آن storageها روی main thread هزینه دارد.
// این Map با refresh کامل پاک می‌شود، اما در navigationهای داخلی Next زنده می‌ماند.

const MAX_ENTRIES = 12;
const cache = new Map();

const cloneFilters = (filters = {}) => ({
  search: filters.search || "",
  minPrice: Number(filters.minPrice) || 0,
  maxPrice: Number(filters.maxPrice) || 0,
  categoryAttributes: Object.fromEntries(Object.entries(filters.categoryAttributes || {}).map(([name, values]) => [name, [...values]])),
});

export function buildBrandGroupedViewCacheKey({
  brandId,
  sportId,
  categoryId,
  attrFilters = [],
  categoryAttributes = {},
  targetAudience,
}) {
  return JSON.stringify([
    String(brandId || ""),
    String(sportId || ""),
    String(categoryId || ""),
    attrFilters,
    categoryAttributes,
    String(targetAudience || ""),
  ]);
}

// امضای پایدارِ یک مجموعه فیلتر (ترتیبِ کلیدها/مقادیر بی‌اثر است).
const filtersSignature = (filters) => {
  const f = cloneFilters(filters);
  return JSON.stringify([
    f.search,
    f.minPrice,
    f.maxPrice,
    Object.entries(f.categoryAttributes)
      .map(([name, values]) => [name, values.sort()])
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  ]);
};

/**
 * entryFilters = فیلترهایی که همین حالا از URL خوانده شده‌اند.
 *
 * نمای ذخیره‌شده فقط وقتی برمی‌گردد که با «دقیقاً همان» فیلترها ساخته شده باشد.
 * این Map در navigationهای داخلی زنده می‌ماند و با کلیدِ *ورود* نوشته می‌شود، نه
 * با فیلترِ لحظه‌ی نوشتن؛ بدون این بررسی، فیلتر کردن روی یک آدرسِ بدون پارامتر و
 * بازگشت بعدی به همان آدرس (مثلاً از نوبار) همان فیلتر را دوباره اعمال می‌کرد،
 * بی‌آنکه در نوار آدرس دیده شود. منبعِ حقیقتِ فیلتر، URL است.
 */
export function readBrandGroupedViewCache(key, entryFilters) {
  const value = cache.get(key);
  if (!value) return null;
  if (filtersSignature(value.filters) !== filtersSignature(entryFilters)) {
    cache.delete(key);
    return null;
  }

  // Map را به‌صورت LRU نگه دار تا مرور طولانی بین برندهای زیاد حافظه را رشد ندهد.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function writeBrandGroupedViewCache(key, snapshot) {
  const value = {
    sections: snapshot.sections || [],
    index: snapshot.index || [],
    nextOffset: snapshot.nextOffset ?? 0,
    nextProductOffset: snapshot.nextProductOffset ?? 0,
    hasMore: Boolean(snapshot.hasMore),
    totalCount: snapshot.totalCount ?? 0,
    filters: cloneFilters(snapshot.filters),
  };

  cache.delete(key);
  cache.set(key, value);

  if (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}
