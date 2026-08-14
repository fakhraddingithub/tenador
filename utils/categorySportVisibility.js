const asIdString = (value) => {
  const candidate = value?._id ?? value;
  if (candidate === undefined || candidate === null) return "";
  return String(candidate).trim();
};

/**
 * Normalizes an id array without changing the original order.
 * `null`/`undefined` are treated as the backward-compatible empty value.
 * A non-array payload is rejected with `null` so API callers can distinguish
 * malformed input from an omitted field.
 */
export function normalizeSportIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    const id = asIdString(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export function getCategorySportIds(category) {
  if (!category) return [];

  const ownerId = asIdString(category.sport);
  const additional = normalizeSportIds(category.additionalSports) || [];
  const all = ownerId ? [ownerId, ...additional] : additional;
  return [...new Set(all)];
}

export function categorySupportsSport(category, sportId) {
  const target = asIdString(sportId);
  return Boolean(target && getCategorySportIds(category).includes(target));
}

export function isSharedCategory(category) {
  return (normalizeSportIds(category?.additionalSports) || []).length > 0;
}

/**
 * Category lookup used by /[sport]/[category]. Legacy categories still match
 * only their owner sport; shared categories additionally match selected sports.
 */
export function buildCategorySportMatch(sportId) {
  if (!sportId) return { _id: { $exists: false } };
  return {
    $or: [
      { sport: sportId },
      { additionalSports: sportId },
    ],
  };
}

/**
 * Product visibility for a sport-only page. The direct sport branch preserves
 * all legacy behavior; the category branch opts in only explicitly shared
 * categories. Both branches are backed by existing Product indexes.
 */
export function buildProductSportMatch(sportId, sharedCategoryIds = []) {
  if (!sportId) return { _id: { $exists: false } };
  const ids = Array.isArray(sharedCategoryIds)
    ? sharedCategoryIds.filter(Boolean)
    : [];

  if (ids.length === 0) return { sport: sportId };
  return {
    $or: [
      { sport: sportId },
      { category: { $in: ids } },
    ],
  };
}

/**
 * A category page keeps the exact legacy { sport, category } behavior until
 * the category is explicitly shared. Once shared, all products in that
 * category are intentionally visible in every configured sport.
 */
export function buildCategoryProductSportMatch(category, sportId) {
  if (!categorySupportsSport(category, sportId)) {
    return { _id: { $exists: false } };
  }
  return isSharedCategory(category) ? {} : { sport: sportId };
}

/**
 * Safely combines filters that may each contain `$or`. Spreading two such
 * filters would silently overwrite one branch and widen or narrow results.
 */
export function andMongoFilters(...filters) {
  const usable = filters.filter(
    (filter) => filter && typeof filter === "object" && Object.keys(filter).length > 0,
  );
  if (usable.length === 0) return {};
  if (usable.length === 1) return usable[0];
  return { $and: usable };
}

