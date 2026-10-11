import "base/models/registerModels";
import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { collectCategorySubtree } from "base/utils/categorySubtree";
import {
  andMongoFilters,
  buildCategorySportMatch,
  isSharedCategory,
} from "base/utils/categorySportVisibility";

const getCategoryTree = unstable_cache(async (sportId) => {
  await connectToDB();
  const categories = await Category.find(sportId
    ? buildCategorySportMatch(new mongoose.Types.ObjectId(sportId)) : {})
    .select("_id parent sport additionalSports title name order").lean();
  return JSON.parse(JSON.stringify(categories));
}, ["storefront-category-tree-v1"], { revalidate: 300, tags: ["categories"] });

export async function getCategorySubtree(categoryId, sportId = null) {
  return collectCategorySubtree(
    await getCategoryTree(sportId ? String(sportId) : null), categoryId,
  );
}

/** Each descendant keeps its own sport-sharing rules, never its parent's. */
export async function getCategorySubtreeMatch(categoryId, sportId = null) {
  const categories = await getCategorySubtree(categoryId, sportId);
  const oid = (value) => new mongoose.Types.ObjectId(String(value));
  if (!sportId) return { category: { $in: categories.map((c) => oid(c._id)) } };
  const shared = categories.filter(isSharedCategory).map((c) => oid(c._id));
  const local = categories.filter((c) => !isSharedCategory(c)).map((c) => oid(c._id));
  const branches = [];
  if (local.length) branches.push({ category: { $in: local }, sport: oid(sportId) });
  if (shared.length) branches.push({ category: { $in: shared } });
  return branches.length ? { $or: branches } : { _id: { $in: [] } };
}

export async function applyCategorySubtree(baseFilter, { categoryId, sportId }) {
  return andMongoFilters(baseFilter, await getCategorySubtreeMatch(categoryId, sportId));
}
