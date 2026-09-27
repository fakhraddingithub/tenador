/**
 * services/miniArticle.service.js
 *
 * Reads the block-based mini articles attached to a brand+category page and to
 * a serie page. Both fields are select:false on their models, so nothing else
 * that loads brands/series ever carries them; these are the only public reads.
 *
 * Uncached on purpose, exactly like the root brand article (which comes from the
 * uncached resolvePageContext): the pages are force-dynamic and each read is a
 * single _id lookup, so an admin save shows up on the next request.
 */

import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Serie from "base/models/Serie";

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
 * بروشورِ منتشرشده‌ی برند، یا null. پیش‌نویس هرگز برنمی‌گردد — شرطِ status در خودِ
 * کوئری است، پس محتوای منتشرنشده اصلاً از دیتابیس بیرون نمی‌آید.
 */
export async function getPublishedBrandBrochure(brandId) {
  const brand = toObjectId(brandId);
  if (!brand) return null;

  await connectToDB();
  const doc = await Brand.findOne(
    { _id: brand, "brochure.status": "published" },
    { brochure: 1 },
  ).lean();
  const blocks = doc?.brochure?.blocks;
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
}
