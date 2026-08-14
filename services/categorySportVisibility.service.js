import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import {
  andMongoFilters,
  buildCategoryProductSportMatch,
  buildCategorySportMatch,
  buildProductSportMatch,
} from "base/utils/categorySportVisibility";

const CACHE_TTL = 10800;

const asObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};

const getCachedCategorySportConfig = unstable_cache(
  async (categoryId) => {
    const oid = asObjectId(categoryId);
    if (!oid) return null;
    await connectToDB();
    const category = await Category.findById(oid)
      .select("_id sport additionalSports")
      .lean();
    if (!category) return null;
    return JSON.parse(JSON.stringify(category));
  },
  ["category-sport-config-v1"],
  { revalidate: CACHE_TTL, tags: ["categories"] },
);

const getCachedSharedCategoryIdStrings = unstable_cache(
  async (sportId) => {
    const oid = asObjectId(sportId);
    if (!oid) return [];
    await connectToDB();

    const categories = await Category.find({
      ...buildCategorySportMatch(oid),
      "additionalSports.0": { $exists: true },
    })
      .select("_id")
      .lean();

    return categories.map((category) => category._id.toString());
  },
  ["shared-category-ids-by-sport-v1"],
  { revalidate: CACHE_TTL, tags: ["categories"] },
);

export async function getSharedCategoryIdsForSport(sportId) {
  const ids = await getCachedSharedCategoryIdStrings(String(sportId || ""));
  return ids.map(asObjectId).filter(Boolean);
}

export async function getCategoryForSport(categoryId, sportId) {
  const categoryOid = asObjectId(categoryId);
  const sportOid = asObjectId(sportId);
  if (!categoryOid || !sportOid) return null;
  await connectToDB();
  return Category.findOne({
    _id: categoryOid,
    ...buildCategorySportMatch(sportOid),
  }).lean();
}

/**
 * Builds the effective Product match for a storefront sport context.
 * Passing categoryId validates the pair and preserves legacy category pages.
 */
export async function getProductSportVisibilityMatch({
  sportId,
  categoryId = null,
  category = null,
} = {}) {
  const sportOid = asObjectId(sportId);
  if (!sportOid) return { _id: { $exists: false } };

  if (categoryId || category?._id) {
    const config = category || await getCachedCategorySportConfig(
      String(categoryId || category?._id),
    );
    return buildCategoryProductSportMatch(config, sportOid);
  }

  const sharedIds = await getSharedCategoryIdsForSport(sportOid);
  return buildProductSportMatch(sportOid, sharedIds);
}

export async function applyProductSportVisibility(baseFilter, options) {
  const visibility = await getProductSportVisibilityMatch(options);
  return andMongoFilters(baseFilter, visibility);
}

export async function getProductsVisibleInAnySportMatch(sportIds) {
  const ids = [
    ...new Map(
      (Array.isArray(sportIds) ? sportIds : [])
        .map(asObjectId)
        .filter(Boolean)
        .map((sportId) => [String(sportId), sportId]),
    ).values(),
  ];
  if (ids.length === 0) return { _id: { $exists: false } };

  const sharedCategoryIds = [
    ...new Map(
      (await Promise.all(ids.map(getSharedCategoryIdsForSport)))
        .flat()
        .map((categoryId) => [String(categoryId), categoryId]),
    ).values(),
  ];

  if (sharedCategoryIds.length === 0) return { sport: { $in: ids } };
  return {
    $or: [
      { sport: { $in: ids } },
      { category: { $in: sharedCategoryIds } },
    ],
  };
}
