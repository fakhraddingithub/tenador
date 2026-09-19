import mongoose from "mongoose";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";

/**
 * Brand.categoryArticles: one mini article per (brand, category).
 *
 * The category id is the entry's identity, so a duplicate category is an
 * error rather than a silent "last one wins" — the admin would otherwise lose
 * one of the two articles without being told. An entry with no blocks is
 * dropped: it would render nothing, and keeping it only leaves dead data.
 * Checking that each category actually exists needs the DB, so it is left to
 * the route (see findMissingCategoryIds).
 */
export function sanitizeBrandCategoryArticles(value, errors) {
  if (!Array.isArray(value)) {
    errors.categoryArticles = "categoryArticles must be an array";
    return [];
  }

  const seen = new Set();
  const out = [];
  value.forEach((entry, index) => {
    const prefix = `categoryArticles.${index}`;
    const category = String(entry?.category?._id || entry?.category || "");
    if (!mongoose.isValidObjectId(category)) {
      errors[`${prefix}.category`] = "دسته‌بندی مینی مقاله نامعتبر است";
      return;
    }
    if (seen.has(category)) {
      errors[`${prefix}.category`] = "برای هر دسته‌بندی فقط یک مینی مقاله مجاز است";
      return;
    }
    seen.add(category);

    const blockErrors = {};
    const blocks = sanitizeArticleBlocks(entry?.blocks, blockErrors);
    for (const [key, message] of Object.entries(blockErrors)) {
      errors[`${prefix}.${key}`] = message;
    }
    if (blocks.length > 0) out.push({ category, blocks });
  });
  return out;
}

export async function findMissingCategoryIds(Category, entries) {
  const ids = entries.map((entry) => entry.category);
  if (ids.length === 0) return [];
  const found = await Category.find({ _id: { $in: ids } }).select("_id").lean();
  const existing = new Set(found.map((doc) => String(doc._id)));
  return ids.filter((id) => !existing.has(id));
}
