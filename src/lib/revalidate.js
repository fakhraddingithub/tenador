import { revalidatePath, revalidateTag } from "next/cache";

/**
 * تمام تگ‌های محتوایی کش‌شده را باطل می‌کند.
 * چون عملیات ادمین کم‌تکرار است، باطل‌سازی گسترده امن‌تر از باطل‌سازی ناقص است
 * (هیچ‌وقت داده‌ی قدیمی به کاربر نشان داده نمی‌شود).
 *
 * این تابع را پس از هر mutation (ساخت/ویرایش/حذف) روی محتوای عمومی صدا بزنید.
 */
const CONTENT_TAGS = [
  "products",
  "navbar",
  "banners",
  "athletes",
  "sports",
  "categories",
  "brands",
  "series",
  "limited-editions",
  "events",
];

export function revalidateContent(tags = CONTENT_TAGS) {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch {
      // در محیط‌هایی که revalidateTag در دسترس نیست بی‌صدا رد شو
    }
  }
}

const safeSlug = (value) =>
  typeof value === "string" && /^[\p{L}\p{N}_-]+$/u.test(value.trim())
    ? value.trim()
    : "";

/**
 * Invalidates only the route families whose membership changes when a
 * category is added to, removed from, or moved between sports. Data caches
 * are invalidated separately through revalidateContent().
 */
export function revalidateCategoryVisibilityPaths({
  sportSlugs = [],
  categorySlug = "",
} = {}) {
  const normalizedCategorySlug = safeSlug(categorySlug);
  const normalizedSportSlugs = [
    ...new Set((sportSlugs || []).map(safeSlug).filter(Boolean)),
  ];

  const exactPaths = new Set([
    "/second-hand",
    "/sitemap.xml",
    "/api/storefront/products",
  ]);
  const layoutPaths = new Set();

  for (const sportSlug of normalizedSportSlugs) {
    layoutPaths.add(`/${sportSlug}`);
    layoutPaths.add(`/second-hand/${sportSlug}`);
    if (normalizedCategorySlug) {
      exactPaths.add(`/${sportSlug}/${normalizedCategorySlug}`);
      exactPaths.add(`/second-hand/${sportSlug}/${normalizedCategorySlug}`);
    }
  }

  for (const path of exactPaths) {
    try {
      revalidatePath(path);
    } catch {
      // Cache invalidation must never make a successful admin mutation fail.
    }
  }
  for (const path of layoutPaths) {
    try {
      revalidatePath(path, "layout");
    } catch {
      // Same best-effort behavior as revalidateContent().
    }
  }
}
