import "base/models/registerModels";
import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Serie from "base/models/Serie";
import LimitedEdition from "base/models/LimitedEdition";
import { applyProductSportVisibility } from "base/services/categorySportVisibility.service";
import { buildTargetAudienceMatch } from "base/utils/targetAudience";
import { buildCollaborationScopes, collaborationMatchBranches } from "base/utils/brandCollaboration";
import { buildAttributeMeta, mergeAttributeMeta, productMatchesAttrFilters } from "@/lib/attributeFilters";

const oid = (value) => new mongoose.Types.ObjectId(String(value));

// A lightweight, unpriced snapshot of the WHOLE listing, not its first batch.
// It stays server-side; only category names and filter options reach the browser.
const getCatalog = unstable_cache(async (scope) => {
  await connectToDB();
  let match = { isActive: true };
  if (scope.categoryId) match.category = oid(scope.categoryId);
  if (scope.serieId) {
    const parent = await Serie.findById(scope.serieId).select("brand").lean();
    if (!parent) return { products: [], categories: [] };
    match.brand = parent.brand;
    const ids = new Set([String(scope.serieId)]);
    if (scope.descendants !== false) {
      const tree = await Serie.find({ brand: parent.brand }).select("parentSerie").lean();
      let changed = true;
      while (changed) {
        changed = false;
        for (const child of tree) {
          if (ids.has(String(child.parentSerie)) && !ids.has(String(child._id))) {
            ids.add(String(child._id));
            changed = true;
          }
        }
      }
    }
    match.serie = { $in: [...ids].map(oid) };
  } else if (scope.brandId) {
    const editions = await LimitedEdition.find({ relatedBrands: scope.brandId }).select("brand").lean();
    const branches = collaborationMatchBranches(buildCollaborationScopes(editions, scope.brandId), oid);
    match.$or = [{ brand: oid(scope.brandId) }, ...branches];
  } else {
    return { products: [], categories: [] };
  }
  const audience = buildTargetAudienceMatch(scope.targetAudience);
  if (audience) match.targetAudience = audience;
  if (scope.sportId) match = await applyProductSportVisibility(match, {
    sportId: scope.sportId, categoryId: scope.categoryId || null,
  });
  const products = await Product.find(match).select("category attributes color variants")
    .populate({ path: "category", select: "title name order attributes" })
    .populate({ path: "variants", select: "attributes color" }).lean();
  const categories = new Map();
  for (const product of products) {
    const category = product.category;
    if (!category?._id) continue;
    const id = String(category._id);
    if (!categories.has(id)) categories.set(id, { ...category, products: [] });
    categories.get(id).products.push(product);
  }
  return JSON.parse(JSON.stringify({
    products: products.map((p) => ({ ...p, category: p.category?._id || null })),
    categories: [...categories.values()]
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .map((category) => ({
        _id: category._id, title: category.title || category.name,
        attributeMeta: buildAttributeMeta(category.attributes, category.products),
      })),
  }));
}, ["listing-filter-catalog-v1"], {
  revalidate: 300, tags: ["products", "categories", "series", "brands", "limited-editions"],
});

export async function getListingFilterOptions(scope) {
  return (await getCatalog(scope)).categories;
}

// دامنه‌ی دسته‌ها را به لیستی از رشته‌های id تبدیل می‌کند (یکی، چندتا، یا هیچ).
const toIdList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

/**
 * فیلترِ ویژگی‌های دسته → یک شرطِ _id روی محصولات.
 *
 * categoryIds می‌تواند یک id، آرایه‌ای از idها، یا خالی باشد؛ خالی یعنی «همه‌ی
 * دسته‌های این لیست» — دقیقاً همان مجموعه‌ای که سایدبار ویژگی‌هایش را نشان
 * می‌دهد. متادیتا سمتِ سرور ساخته می‌شود، پس نامِ فیلدی که کاربر می‌فرستد
 * هرگز به یک مسیرِ Mongo تبدیل نمی‌شود.
 */
export async function buildCategoryAttributeMatch(scope, categoryIds, selections = {}) {
  if (!Object.values(selections || {}).some((v) => Array.isArray(v) && v.length)) return {};
  const ids = toIdList(categoryIds);
  const { categories, products } = await getCatalog(scope);
  const active = ids.length ? categories.filter((c) => ids.includes(c._id)) : categories;
  if (active.length === 0) return { _id: { $in: [] } };
  // ادغامِ متادیتا همان چیزی است که کلاینت می‌بیند، پس نتیجه‌ی دو طرف یکی است.
  const meta = mergeAttributeMeta(active);
  const activeIds = new Set(active.map((c) => c._id));
  const matched = products
    .filter((p) => activeIds.has(p.category) && productMatchesAttrFilters(p, selections, meta))
    .map((p) => oid(p._id));
  return { _id: { $in: matched } };
}
