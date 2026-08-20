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
import { resolveSerieSportContent } from "@/lib/serieSportContent";
import { applyProductSportVisibility } from "base/services/categorySportVisibility.service";
import { buildTargetAudienceMatch } from "base/utils/targetAudience";
import { LISTING_FIELDS, POPULATES } from "base/services/productListing.service";
import { withProductSearch } from "@/lib/productSearch";

const DIRECT_KEY = "__direct__";

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
    .select("_id title name description shortDescription slug level brand image logo headImage colors sportImages")
    .lean();
  if (!parent) return null;

  const allSeries = await Serie.find({ brand: parent.brand })
    .select("_id title name description shortDescription slug parentSerie level order image logo headImage colors sportImages")
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

async function buildBaseMatch({ parentSerieId, allDescendantIds, sportId, categoryId, targetAudience, search }) {
  const parentOid = toObjectId(parentSerieId);
  const serieScope = [
    parentOid,
    ...allDescendantIds.map((id) => toObjectId(id.toString())),
  ].filter(Boolean);

  const match = { isActive: true, serie: { $in: serieScope } };
  if (categoryId) match.category = toObjectId(categoryId);
  const audienceMatch = buildTargetAudienceMatch(targetAudience);
  if (audienceMatch) match.targetAudience = audienceMatch;
  // جستجوی توکنی؛ توکنی که در نامِ محصول نیست می‌تواند با برند/سری تطبیق بخورد
  Object.assign(match, await withProductSearch(match, search));
  return sportId
    ? applyProductSportVisibility(match, { sportId, categoryId })
    : match;
}

function withinPrice(p, minPrice, maxPrice) {
  const price = p.finalPriceToman ?? p.basePriceToman ?? 0;
  if (typeof minPrice === "number" && minPrice > 0 && price < minPrice) return false;
  if (typeof maxPrice === "number" && maxPrice > 0 && price > maxPrice) return false;
  return true;
}

/**
 * فهرستِ بخش‌ها + شمارش + دامنه‌ی سریِ هر بخش — مستقل از offset/limit/قیمت،
 * تا همه‌ی batchهای یک ترکیبِ فیلتر یک ورودیِ کش مشترک داشته باشند.
 * (همان الگوی brandGrouped.service.js)
 */
async function _getSerieGroupedIndex(params) {
  const {
    serieId,
    sportId = null,
    categoryId = null,
    targetAudience = null,
    search = "",
  } = params || {};

  await connectToDB();

  const tree = await buildChildTree(serieId);
  if (!tree) return null;

  const { parent, directChildren, descendantsByChild, allDescendantIds } = tree;

  const baseMatch = await buildBaseMatch({
    parentSerieId: serieId,
    allDescendantIds,
    sportId,
    categoryId,
    targetAudience,
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
      const resolved = resolveSerieSportContent(child, sportId);

      index.push({
        key: cId,
        serieId: cId,
        title: child.title || child.name || "",
        description: resolved.description,
        shortDescription: resolved.shortDescription,
        slug: child.slug || null,
        productCount: c,
        image: resolved.image || null,
        headImage: resolved.headImage || null,
        logo: child.logo || null,
      });
    }
  }
  if (directCount > 0) {
    const resolved = resolveSerieSportContent(parent, sportId);

    index.push({
      key: DIRECT_KEY,
      serieId: null,
      title: parent.title || parent.name || "سایر محصولات",
      description: resolved.description,
      shortDescription: resolved.shortDescription,
      slug: null,
      productCount: directCount,
      image: resolved.image || null,
      headImage: resolved.headImage || null,
      logo: null,
    });
  }

  const totalCount = index.reduce((s, e) => s + e.productCount, 0);

  // دامنه‌ی سریِ هر بخش، رشته‌ای تا از unstable_cache سالم عبور کند
  const scopes = {};
  for (const child of directChildren) {
    const cId = child._id.toString();
    const ids = descendantsByChild.get(cId) || [child._id];
    scopes[cId] = ids.map((id) => id.toString());
  }

  return JSON.parse(
    JSON.stringify({
      index,
      totalCount,
      scopes,
      allDescendantIds: allDescendantIds.map((id) => id.toString()),
    })
  );
}

const getSerieGroupedIndex = unstable_cache(
  _getSerieGroupedIndex,
  ["serie-grouped-index", "target-audience-unisex-v1"],
  { revalidate: 10800, tags: ["products", "categories", "series"] }
);

async function _getSerieGroupedSections(params) {
  const {
    serieId,
    sportId = null,
    categoryId = null,
    targetAudience = null,
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

  const [indexPayload, rate] = await Promise.all([
    getSerieGroupedIndex({ serieId, sportId, categoryId, targetAudience, search }),
    getCachedRate(),
  ]);

  if (!indexPayload) {
    return { index: [], sections: [], nextOffset: 0, hasMore: false, totalCount: 0 };
  }

  const { index, totalCount, scopes, allDescendantIds } = indexPayload;

  const baseMatch = await buildBaseMatch({
    parentSerieId: serieId,
    allDescendantIds,
    sportId,
    categoryId,
    targetAudience,
    search,
  });

  const parentOid = toObjectId(serieId);

  const sectionFilter = (entry) => {
    if (entry.key === DIRECT_KEY) return { ...baseMatch, serie: parentOid };
    const ids = (scopes[entry.key] || [entry.key]).map(toObjectId).filter(Boolean);
    return { ...baseMatch, serie: { $in: ids } };
  };

  // پروجکشن + populateهای باریکِ قراردادِ productListing.service
  const listingQuery = (filter) => {
    let q = Product.find(filter).select(LISTING_FIELDS).sort({ order: 1, createdAt: -1 });
    for (const populate of POPULATES) q = q.populate(populate);
    return q.lean();
  };

  // ساختِ بخش‌های این batch — یک قیمت‌گذاری برای کلِ موج، نه یکی برای هر بخش
  const sections = [];
  let cursor = Math.max(0, offset);

  while (sections.length < limit && cursor < index.length) {
    const wave = index.slice(cursor, cursor + (limit - sections.length));
    cursor += wave.length;

    const rawPerEntry = await Promise.all(wave.map((e) => listingQuery(sectionFilter(e))));
    const pricedFlat = await attachListingPrices(rawPerEntry.flat(), rate);

    let at = 0;
    for (let i = 0; i < wave.length; i++) {
      const entry = wave[i];
      const priced = pricedFlat.slice(at, at + rawPerEntry[i].length);
      at += rawPerEntry[i].length;

      const products = priced.filter((p) => withinPrice(p, minPrice, maxPrice));
      if (products.length === 0) continue;
      sections.push({
        key: entry.key,
        serie: {
          _id: entry.serieId,
          title: entry.title,
          description: entry.description,
          shortDescription: entry.shortDescription,
          slug: entry.slug,
          image: entry.image,
          headImage: entry.headImage,
          logo: entry.logo,
        },
        productCount: entry.productCount,
        products,
      });
    }
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
  ["serie-grouped-sections", "target-audience-unisex-v1"],
  { revalidate: 10800, tags: ["products", "categories", "series"] }
);
