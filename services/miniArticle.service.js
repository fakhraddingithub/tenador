/**
 * services/miniArticle.service.js
 *
 * Reads the block-based mini articles attached to a brand+category page and to
 * a serie page. Both fields are select:false on their models, so nothing else
 * that loads brands/series ever carries them; these are the only public reads.
 *
 * The brand+category and serie reads are uncached: those pages sit behind the CDN and
 * each read is a single _id lookup. The brochures are cached under their owner's tag,
 * which every brochure save purges, so an admin save still shows on the next request.
 */

import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Serie from "base/models/Serie";
import Sport from "base/models/Sport";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;

/**
 * هر مینی‌مقاله دو بخش دارد: بالای صفحه و پایینِ آن. شکلِ خروجی همیشه
 * `{ top, bottom }` است — محتوای قدیمی که فقط `blocks` دارد، `bottom` خالی
 * می‌گیرد، پس هیچ مهاجرتی لازم نیست.
 */
const sections = (top, bottom) => ({
  top: Array.isArray(top) ? top : [],
  bottom: Array.isArray(bottom) ? bottom : [],
});

/** Blocks written for exactly this (brand, category) pair — never another category's. */
export async function getBrandCategoryArticleBlocks(brandId, categoryId) {
  const brand = toObjectId(brandId);
  const category = toObjectId(categoryId);
  if (!brand || !category) return sections();

  await connectToDB();
  const doc = await Brand.findOne(
    { _id: brand, "categoryArticles.category": category },
    { categoryArticles: { $elemMatch: { category } } },
  ).lean();
  const entry = doc?.categoryArticles?.[0];
  return entry && String(entry.category) === String(category)
    ? sections(entry.blocks, entry.blocksBottom)
    : sections();
}

export async function getSerieArticleBlocks(serieId) {
  const serie = toObjectId(serieId);
  if (!serie) return sections();

  await connectToDB();
  const doc = await Serie.findById(serie).select("articleBlocks articleBlocksBottom").lean();
  return sections(doc?.articleBlocks, doc?.articleBlocksBottom);
}

/**
 * بروشورِ منتشرشده‌ی یک صاحب (برند یا ورزش)، یا null. پیش‌نویس هرگز برنمی‌گردد —
 * شرطِ status در خودِ کوئری است، پس محتوای منتشرنشده اصلاً از دیتابیس بیرون نمی‌آید.
 */
async function getPublishedBrochure(Model, ownerId) {
  const owner = toObjectId(ownerId);
  if (!owner) return null;

  await connectToDB();
  const doc = await Model.findOne(
    { _id: owner, "brochure.status": "published" },
    { brochure: 1 },
  ).lean();
  const blocks = doc?.brochure?.blocks;
  // Plain JSON, so a fresh read and a cached one have the same shape.
  return Array.isArray(blocks) && blocks.length > 0 ? JSON.parse(JSON.stringify(blocks)) : null;
}

export const getPublishedBrandBrochure = unstable_cache(
  (brandId) => getPublishedBrochure(Brand, brandId),
  ["published-brand-brochure-v1"],
  { revalidate: 10800, tags: ["brands"] },
);
export const getPublishedSportBrochure = unstable_cache(
  (sportId) => getPublishedBrochure(Sport, sportId),
  ["published-sport-brochure-v1"],
  { revalidate: 10800, tags: ["sports"] },
);
