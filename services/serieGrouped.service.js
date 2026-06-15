/**
 * services/serieGrouped.service.js
 *
 * گروه‌بندی محصولاتِ یک سری ریشه (level 0) بر اساس زیرسری‌های مستقیم (level 1).
 * رفتار مشابه brandGrouped.service.js اما دامنه‌ی آن یک سری ریشه است، نه یک برند.
 *
 * خروجی:
 *   { index?, sections, nextOffset, hasMore, totalCount }
 */

import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import Product from "base/models/Product";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

const DIRECT_KEY = "__direct__";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toObjectId(v) {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

/**
 * درختِ فرزندان مستقیم یک سری ریشه را می‌سازد.
 */
async function buildChildTree(parentSerieId) {
  const parent = await Serie.findById(parentSerieId)
    .select("_id title name slug level brand image logo headImage colors")
    .lean();
  if (!parent) return null;

  const allSeries = await Serie.find({ brand: parent.brand })
    .select("_id title name slug parentSerie level order image logo colors")
    .sort({ order: 1, createdAt: -1 })
    .lean();

  // فرزندان مستقیم این سری ریشه
  const directChildren = allSeries.filter(
    (s) => s.parentSerie && s.parentSerie.toString() === parentSerieId.toString()
  );

  // نگاشت هر فرزند مستقیم به تمام فرزندانِ زیرمجموعه‌اش
  const descendantsByChild = new Map();
  const allDescendantIds = [];

  for (const child of directChildren) {
    const childId = child._id.toString();
    const descendants = [child._id];
    const queue = [childId];

    while (queue.length > 0) {
      const cur = queue.shift();
      for (const s of allSeries) {
        if (s.parentSerie && s.parentSerie.toString() === cur) {
          descendants.push(s._id);
          queue.push(s._id.toString());
          if (!allDescendantIds.some((id) => id.toString() === s._id.toString())) {
            allDescendantIds.push(s._id);
          }
        }
      }
    }

    descendantsByChild.set(childId, descendants);
    if (!allDescendantIds.some((id) => id.toString() === child._id.toString())) {
      allDescendantIds.push(child._id);
    }
  }

  return { parent, directChildren, descendantsByChild, allDescendantIds };
}

function buildBaseMatch({ parentSerieId, allDescendantIds, sportId, categoryId, search }) {
  const parentOid = toObjectId(parentSerieId);
  const serieScope = [
    parentOid,
    ...allDescendantIds.map((id) => toObjectId(id.toString())),
  ].filter(Boolean);

  const match = { isActive: true, serie: { $in: serieScope } };
  if (sportId) match.sport = toObjectId(sportId);
  if (categoryId) match.category = toObjectId(categoryId);
  if (search && search.trim()) {
    match.name = { $regex: escapeRegex(search.trim()), $options: "i" };
  }
  return match;
}

function withinPrice(p, minPrice, maxPrice) {
  const price = p.finalPriceToman ?? p.basePriceToman ?? 0;
  if (typeof minPrice === "number" && minPrice > 0 && price < minPrice) return false;
  if (typeof maxPrice === "number" && maxPrice > 0 && price > maxPrice) return false;
  return true;
}

async function _getSerieGroupedSections(params) {
  const {
    serieId,
    sportId = null,
    categoryId = null,
    offset = 0,
    limit = 2,
    minPrice = 0,
    maxPrice = 0,
    search = "",
    withIndex = false,
  } = params || {};

  if (!serieId) {
    return { index: [], sections: [], nextOffset: 0, hasMore: false, totalCount: 0 };
  }

  await connectToDB();

  const [tree, rate] = await Promise.all([buildChildTree(serieId), getCachedRate()]);

  if (!tree) {
    return { index: [], sections: [], nextOffset: 0, hasMore: false, totalCount: 0 };
  }

  const { parent, directChildren, descendantsByChild, allDescendantIds } = tree;

  const baseMatch = buildBaseMatch({
    parentSerieId: serieId,
    allDescendantIds,
    sportId,
    categoryId,
    search,
  });

  // شمارش محصولات هر سری (aggregation سبک)
  const countAgg = await Product.aggregate([
    { $match: baseMatch },
    { $group: { _id: "$serie", count: { $sum: 1 } } },
  ]);

  // نگاشت: شناسه هر سری → شناسه فرزند مستقیم والد
  const serieToChild = {};
  for (const child of directChildren) {
    const childId = child._id.toString();
    const descendants = descendantsByChild.get(childId) || [];
    for (const dId of descendants) {
      serieToChild[dId.toString()] = childId;
    }
    serieToChild[childId] = childId;
  }

  const countByChild = new Map();
  let directCount = 0;

  for (const row of countAgg) {
    const sId = row._id ? row._id.toString() : null;
    if (!sId || sId === serieId.toString()) {
      directCount += row.count;
    } else {
      const cId = serieToChild[sId];
      if (cId) {
        countByChild.set(cId, (countByChild.get(cId) || 0) + row.count);
      } else {
        directCount += row.count;
      }
    }
  }

  // فهرست مرتب‌شده‌ی بخش‌های غیرخالی
  const index = [];
  for (const child of directChildren) {
    const cId = child._id.toString();
    const c = countByChild.get(cId) || 0;
    if (c > 0) {
      index.push({
        key: cId,
        serieId: cId,
        title: child.title || child.name || "",
        slug: child.slug || null,
        productCount: c,
        image: child.image || null,
        logo: child.logo || null,
      });
    }
  }
  if (directCount > 0) {
    index.push({
      key: DIRECT_KEY,
      serieId: null,
      title: parent.title || parent.name || "سایر محصولات",
      slug: null,
      productCount: directCount,
      image: null,
      logo: null,
    });
  }

  const totalCount = index.reduce((s, e) => s + e.productCount, 0);

  const parentOid = toObjectId(serieId);

  // ساختِ بخش‌های این batch
  const sections = [];
  let cursor = Math.max(0, offset);

  const fetchSectionProducts = async (entry) => {
    let productFilter;
    if (entry.key === DIRECT_KEY) {
      productFilter = { ...baseMatch, serie: parentOid };
    } else {
      const childId = entry.key;
      const descendants = descendantsByChild.get(childId) || [toObjectId(childId)];
      productFilter = { ...baseMatch, serie: { $in: descendants } };
    }

    const raw = await Product.find(productFilter)
      .populate("brand sport athlete category serie collaboration")
      .sort({ createdAt: -1 })
      .lean();

    const priced = await attachListingPrices(raw, rate);
    return priced.filter((p) => withinPrice(p, minPrice, maxPrice));
  };

  while (sections.length < limit && cursor < index.length) {
    const entry = index[cursor];
    cursor++;
    const products = await fetchSectionProducts(entry);
    if (products.length === 0) continue;
    sections.push({
      key: entry.key,
      serie: {
        _id: entry.serieId,
        title: entry.title,
        slug: entry.slug,
        image: entry.image,
        logo: entry.logo,
      },
      productCount: entry.productCount,
      products,
    });
  }

  const nextOffset = cursor;
  const hasMore = cursor < index.length;

  return JSON.parse(
    JSON.stringify({
      index: withIndex ? index : undefined,
      sections,
      nextOffset,
      hasMore,
      totalCount,
    })
  );
}

export const getSerieGroupedSections = unstable_cache(
  _getSerieGroupedSections,
  ["serie-grouped-sections"],
  { revalidate: 60, tags: ["products", "series"] }
);
