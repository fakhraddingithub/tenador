/**
 * فیلترِ کلاینتیِ نوار توسط «مخاطبِ هدف» — روی navData ی از پیش کش‌شده اعمال می‌شود
 * (بدونِ round-trip یا کلیدِ کشِ تازه). محصولاتِ «یونی سکس» فقط زیرِ مردانه و
 * زنانه قرار می‌گیرند و هرگز با بچگانه تطبیق داده نمی‌شوند.
 */
import {
  TARGET_AUDIENCE_FILTER_VALUES,
  getEffectiveTargetAudienceFilters,
  targetAudienceListMatches,
} from "base/utils/targetAudience";

export const AUDIENCE_OPTIONS = TARGET_AUDIENCE_FILTER_VALUES;

function matchesAudience(nodeAudiences, selected) {
  if (!selected) return true;
  return targetAudienceListMatches(nodeAudiences, selected);
}

export function collectAvailableAudiences(navData) {
  const storedValues = [];
  for (const sport of navData || []) {
    storedValues.push(...(sport.audiences || []));
  }
  return new Set(getEffectiveTargetAudienceFilters(storedValues));
}

export function filterNavDataByAudience(navData, selected) {
  if (!selected) return navData;
  return navData
    .filter((sport) => matchesAudience(sport.audiences, selected))
    .map((sport) => ({
      ...sport,
      categories: (sport.categories || [])
        .filter((cat) => matchesAudience(cat.audiences, selected))
        .map((cat) => ({
          ...cat,
          brands: (cat.brands || []).filter((b) =>
            matchesAudience(b.audiences, selected),
          ),
        })),
    }));
}

export function withQueryParams(href, params) {
  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return query ? `${href}?${query}` : href;
}
