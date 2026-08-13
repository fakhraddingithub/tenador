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
});

export function buildBrandGroupedViewCacheKey({
  brandId,
  sportId,
  categoryId,
  attrFilters = [],
  targetAudience,
}) {
  return JSON.stringify([
    String(brandId || ""),
    String(sportId || ""),
    String(categoryId || ""),
    attrFilters,
    String(targetAudience || ""),
  ]);
}

export function readBrandGroupedViewCache(key) {
  const value = cache.get(key);
  if (!value) return null;

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
