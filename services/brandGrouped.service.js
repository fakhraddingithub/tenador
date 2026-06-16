/**
 * services/brandGrouped.service.js
 *
 * گروه‌بندی محصولاتِ یک برند بر اساس «سری‌های ریشه» (Level 0) با بارگذاری
 * بخش‌به‌بخش (infinite scroll). محصولاتِ زیرسری‌ها زیر همان سری ریشه‌ی والدشان
 * نمایش داده می‌شوند (مثلاً Blade V10 و Blade V5 زیر بخش Blade).
 *
 * این سرویس فقط سمت سرور اجرا می‌شود و با unstable_cache کش می‌شود تا
 * درخواست‌های پیمایش (scroll) سبک و بدون بار اضافه باشند.
 *
 * خروجی هر فراخوانی:
 *   {
 *     index?:      [{ key, serieId, title, slug, productCount, image, logo }]  // فقط در offset=0
 *     sections:    [{ key, serie, productCount, products: [...priced] }]
 *     nextOffset:  number   // اندیس بعدی برای ادامه‌ی بارگذاری
 *     hasMore:     boolean
 *     totalCount:  number   // مجموع محصولاتِ منطبق با فیلتر (برای نمایش تعداد)
 *   }
 */

import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import Product from "base/models/Product";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

const OTHER_KEY = "__other__";

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
 * درختِ سری‌های یک برند را می‌سازد و نگاشتِ «هر سری → سری ریشه» را برمی‌گرداند.
 */
async function buildSeriesTree(brandId) {
  const series = await Serie.find({ brand: brandId })
    .select("_id title name slug parentSerie level order image logo colors")
    .sort({ order: 1, createdAt: -1 })
    .lean();

  const byId = new Map(series.map((s) => [s._id.toString(), s]));

  // ریشه‌ی هر سری با بالا رفتن از زنجیره‌ی parentSerie (با memo و جلوگیری از حلقه)
  const rootCache = new Map();
  const rootIdFor = (id) => {
    const key = id?.toString();
    if (!key) return null;
    if (rootCache.has(key)) return rootCache.get(key);

    let cur = byId.get(key);
    const seen = new Set();
    while (cur && cur.parentSerie && !seen.has(cur._id.toString())) {
      seen.add(cur._id.toString());
      const parent = byId.get(cur.parentSerie.toString());
      if (!parent) break;
      cur = parent;
    }
    const rid = cur ? cur._id.toString() : null;
    rootCache.set(key, rid);
    return rid;
  };

  // سری‌های ریشه (بدون والد) به ترتیبِ order
  const roots = series.filter((s) => !s.parentSerie);

  // همه‌ی شناسه‌های سریِ هر ریشه (شاملِ خودِ ریشه)
  const descendantsByRoot = new Map();
  for (const s of series) {
    const rid = rootIdFor(s._id);
    if (!rid) continue;
    if (!descendantsByRoot.has(rid)) descendantsByRoot.set(rid, []);
    descendantsByRoot.get(rid).push(s._id);
  }

  return { series, byId, roots, rootIdFor, descendantsByRoot };
}

/**
 * فیلتر پایه‌ی محصول (برند + ورزش + دسته + جستجو). قیمت جداگانه روی قیمت تومانی اعمال می‌شود.
 */
function buildBaseMatch({ brandId, sportId, categoryId, search }) {
  const match = { isActive: true, brand: toObjectId(brandId) };
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

async function _getBrandGroupedSections(params) {
  const {
    brandId,
    sportId = null,
    categoryId = null,
    offset = 0,
    limit = 2,
    minPrice = 0,
    maxPrice = 0, // 0 یعنی بدون سقف
    search = "",
    withIndex = false,
  } = params || {};

  if (!brandId) {
    return { index: [], sections: [], nextOffset: 0, hasMore: false, totalCount: 0 };
  }

  await connectToDB();

  const [{ byId, roots, rootIdFor, descendantsByRoot }, rate] = await Promise.all([
    buildSeriesTree(brandId),
    getCachedRate(),
  ]);

  const baseMatch = buildBaseMatch({ brandId, sportId, categoryId, search });

  // ── شمارش محصولات هر سری با یک aggregation و رول‌آپ به سری ریشه ──
  const countAgg = await Product.aggregate([
    { $match: baseMatch },
    { $group: { _id: "$serie", count: { $sum: 1 } } },
  ]);

  const countByRoot = new Map();
  let otherCount = 0;
  for (const row of countAgg) {
    const serieId = row._id ? row._id.toString() : null;
    const rid = serieId ? rootIdFor(serieId) : null;
    if (rid && byId.has(rid)) {
      countByRoot.set(rid, (countByRoot.get(rid) || 0) + row.count);
    } else {
      // سری null یا سریِ یتیم (خارج از این برند) → بخشِ «سایر»
      otherCount += row.count;
    }
  }

  // ── فهرستِ مرتب‌شده‌ی بخش‌های غیرخالی (ریشه‌ها به ترتیب order، سپس «سایر») ──
  const index = [];
  for (const root of roots) {
    const rid = root._id.toString();
    const c = countByRoot.get(rid) || 0;
    if (c > 0) {
      index.push({
        key: rid,
        serieId: rid,
        title: root.title || root.name || "",
        slug: root.slug || null,
        productCount: c,
        image: root.image || null,
        logo: root.logo || null,
      });
    }
  }
  if (otherCount > 0) {
    index.push({
      key: OTHER_KEY,
      serieId: null,
      title: "سایر محصولات",
      slug: null,
      productCount: otherCount,
      image: null,
      logo: null,
    });
  }

  const totalCount =
    index.reduce((s, e) => s + e.productCount, 0);

  const allSerieIds = Array.from(byId.values()).map((s) => s._id);

  // ── ساختِ بخش‌های این batch (با رد کردنِ بخش‌هایی که با فیلتر قیمت خالی می‌شوند) ──
  const sections = [];
  let cursor = Math.max(0, offset);

  const fetchSectionProducts = async (entry) => {
    let productFilter;
    if (entry.key === OTHER_KEY) {
      productFilter = {
        ...baseMatch,
        $or: [
          { serie: null },
          { serie: { $exists: false } },
          { serie: { $nin: allSerieIds } },
        ],
      };
    } else {
      const ids = descendantsByRoot.get(entry.key) || [toObjectId(entry.key)];
      productFilter = { ...baseMatch, serie: { $in: ids } };
    }

    const raw = await Product.find(productFilter)
      .populate("brand sport athlete category serie limitedEdition")
      .sort({ createdAt: -1 })
      .lean();

    const priced = await attachListingPrices(raw, rate);
    return priced.filter((p) => withinPrice(p, minPrice, maxPrice));
  };

  while (sections.length < limit && cursor < index.length) {
    const entry = index[cursor];
    cursor++;
    const products = await fetchSectionProducts(entry);
    if (products.length === 0) continue; // با فیلتر قیمت خالی شد → رد
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

export const getBrandGroupedSections = unstable_cache(
  _getBrandGroupedSections,
  ["brand-grouped-sections"],
  { revalidate: 60, tags: ["products", "series", "brands"] }
);
