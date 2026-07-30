/**
 * فیلترِ کلاینتیِ نوار توسط «مخاطبِ هدف» — روی navData ی از پیش کش‌شده اعمال می‌شود
 * (بدونِ round-trip یا کلیدِ کشِ تازه). محصولاتِ «همه» (یونیسکس) زیرِ هر مخاطبِ
 * خاصی هم مطابقت دارند، دقیقاً مثلِ فیلترِ storefront (services/productListing.service.js).
 */
export const AUDIENCE_OPTIONS = ["مردانه", "زنانه", "بچگانه"];

function matchesAudience(nodeAudiences, selected) {
  if (!selected) return true;
  const list = nodeAudiences || [];
  return list.includes(selected) || list.includes("همه");
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
