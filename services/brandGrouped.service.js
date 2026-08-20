/**
 * services/brandGrouped.service.js
 *
 * گروه‌بندی محصولاتِ یک برند بر اساس «سری‌های ریشه» (Level 0) با بارگذاری
 * بخش‌به‌بخش (infinite scroll). محصولاتِ زیرسری‌ها زیر همان سری ریشه‌ی والدشان
 * نمایش داده می‌شوند (مثلاً Blade V10 و Blade V5 زیر بخش Blade).
 *
 * «همکاری‌ها» (لیمیتد ادیشن‌های برندهای دیگر که این برند را در relatedBrands
 * دارند) بخشِ مستقل ندارند؛ محصولاتشان زیرِ همان بخشِ «محصولات <برند>» می‌آیند و
 * به برندِ مالکِ همان ادیشن محدودند (utils/brandCollaboration.js).
 *
 * این سرویس فقط سمت سرور اجرا می‌شود و با unstable_cache کش می‌شود تا
 * درخواست‌های پیمایش (scroll) سبک و بدون بار اضافه باشند.
 *
 * خروجی هر فراخوانی:
 *   {
 *     index?:      [{ key, serieId, title, shortDescription, slug, productCount, image, logo }]  // فقط در offset=0
 *     sections:    [{ key, serie, productCount, products: [...priced] }]
 *     nextOffset:  number   // اندیس section بعدی/فعلی برای ادامه‌ی بارگذاری
 *     nextProductOffset: number // موقعیت ادامه داخل section فعلی
 *     hasMore:     boolean
 *     totalCount:  number   // مجموع محصولاتِ منطبق با فیلتر (برای نمایش تعداد)
 *   }
 */

import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Serie from "base/models/Serie";
import Brand from "base/models/Brand";
import LimitedEdition from "base/models/LimitedEdition";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getCachedRate } from "@/lib/Exchangerate";
import { buildLenientPersianRegexSource } from "@/lib/persianNormalize";
import { attachListingPrices } from "base/services/priceEngine";
import { resolveSerieSportContent } from "@/lib/serieSportContent";
import { applyProductSportVisibility } from "base/services/categorySportVisibility.service";
import { andMongoFilters } from "base/utils/categorySportVisibility";
import { withProductSearch } from "@/lib/productSearch";
import {
  buildTargetAudienceMatch,
  LISTING_FIELDS,
  POPULATES,
} from "base/services/productListing.service";
import {
  buildCollaborationScopes,
  collaborationMatchBranches,
} from "base/utils/brandCollaboration";
import {
  BRAND_PRODUCTS_PER_BATCH,
  BRAND_SECTIONS_PER_BATCH,
  planGroupedProductPage,
} from "base/utils/groupedProductPagination";

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
    .select("_id title name description shortDescription slug parentSerie level order image logo headImage colors sportImages")
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
 * فیلتر پایه‌ی محصول (برند + ورزش + دسته + جستجو + فیلترِ ویژگی). قیمت جداگانه روی
 * قیمت تومانی اعمال می‌شود. `extra` قطعه‌ی match اضافیِ از پیش‌ساخته‌ی فیلترِ ویژگی است
 * (برای ویژگیِ ثابت: attributes.<name>؛ برای متغیر: _id ∈ productIdsِ واریانت).
 *
 * brandId = null یعنی «بدونِ قیدِ برند» — برای شاخه‌های همکاری که برندشان
 * جداگانه و به‌ازای هر ادیشن (برندِ مالک) تعیین می‌شود.
 */
async function buildBaseMatch({
  brandId,
  sportId,
  categoryId,
  search,
  extra,
  targetAudience,
}) {
  const brandObjectId = toObjectId(brandId);
  const match = { isActive: true };
  if (brandObjectId) match.brand = brandObjectId;
  if (categoryId) match.category = toObjectId(categoryId);
  if (extra && typeof extra === "object") Object.assign(match, extra);
  // مخاطبِ هدف (navbar audience tabs) — مستقلِ کاملِ فیلترهای موجودیتی/ویژگی بالا
  const audienceMatch = buildTargetAudienceMatch(targetAudience);
  if (audienceMatch) match.targetAudience = audienceMatch;
  // جستجوی توکنی؛ توکنی که در نامِ محصول نیست می‌تواند با برند/سری تطبیق بخورد
  Object.assign(match, await withProductSearch(match, search));
  return sportId
    ? applyProductSportVisibility(match, { sportId, categoryId })
    : match;
}

/**
 * Limited Editionهای یک برند مهمان را با برند مالکشان می‌گیرد.
 * این lookup فقط برای برندهایی نتیجه دارد که واقعاً collaboration تعریف کرده‌اند.
 */
async function getRelatedLimitedEditions(brandId) {
  return LimitedEdition.find({ relatedBrands: brandId })
    .select("_id brand")
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * عنوانِ بخشی که محصولاتِ بدونِ سریِ خودِ برند (به‌علاوه‌ی محصولاتِ همکاری) را
 * نگه می‌دارد: «محصولات ویلسون» به‌جای «سایر محصولات». عنوانِ فارسیِ برند مقدم
 * است و اگر برند پیدا نشد، «محصولات» تنها می‌ماند (نه یک دنباله‌ی خالی).
 */
function otherSectionTitle(brand) {
  const brandTitle = (brand?.title || brand?.name || "").trim();
  return brandTitle ? `محصولات ${brandTitle}` : "محصولات";
}

/**
 * محصولاتِ همکاری = اجتماعِ شاخه‌های «برندِ مالک + ادیشن»، روی همان فیلترِ پایه‌ی
 * صفحه (ورزش/دسته/جستجو/ویژگی/مخاطب) اما بدونِ قیدِ برندِ صفحه.
 * برمی‌گرداند null اگر هیچ همکاریِ معتبری نباشد.
 */
function buildCollaborationMatch(brandlessBaseMatch, collaborationScopes) {
  const branches = collaborationMatchBranches(collaborationScopes, toObjectId);
  if (branches.length === 0) return null;
  return andMongoFilters(brandlessBaseMatch, { $or: branches });
}

/**
 * مقادیرِ تطبیقِ یک مقدارِ فیلتر — دقیقاً هم‌راستا با هلپرِ مشترکِ
 * productMatchesAttrFilters در src/lib/attributeFilters.js:
 *  • مقدارِ عددی → تطبیقِ «دقیق». فیلدِ attributes روی محصول از نوعِ Object است و
 *    اعداد عیناً عددی ذخیره می‌شوند (مثلِ capacity: 6, نه "6")، در حالی که regex
 *    هرگز فیلدِ عددی را match نمی‌کند. پس هم خودِ «عدد» و هم شکلِ «رشته‌ای»‌اش در
 *    $in گذاشته می‌شود تا چه عددی و چه رشته‌ای ذخیره شده باشد، بخورد.
 *  • مقدارِ متنی → تطبیقِ substring بدونِ حساسیت به حروف.
 */
function attrValueMatchers(v) {
  const s = (v == null ? "" : String(v)).trim();
  if (s === "") return [];
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const out = [s];
    const n = Number(s);
    if (!Number.isNaN(n)) out.push(n);
    return out;
  }
  const escaped = escapeRegex(s);
  const lenientSource = buildLenientPersianRegexSource(escaped);
  return [new RegExp(lenientSource, "i")];
}

/**
 * قطعه‌ی match فیلترهای ویژگی (از پارامترهای URL) را می‌سازد.
 *
 * نکته‌ی کلیدی: مقدارِ یک ویژگی می‌تواند روی «خودِ محصول» (attributes ثابت) یا روی
 * «واریانت‌ها» (attributes متغیر) ذخیره شده باشد — دقیقاً مثلِ مگامنو که مقادیر را
 * از اجتماعِ هر دو منبع کشف می‌کند. بنابراین تطبیق هم باید هر دو را بررسی کند و به
 * طبقه‌بندیِ ثابت/متغیرِ schemaِ دسته وابسته نباشد: یک محصول منطبق است اگر
 * attributes خودش یا attributes یکی از واریانت‌هایش با مقدار بخورد.
 *
 * هر ویژگی می‌تواند چند مقدار داشته باشد (OR درونِ ویژگی) و ویژگی‌ها با AND ترکیب
 * می‌شوند. بازگشتِ {} یعنی فیلتری اعمال نمی‌شود.
 */
async function buildAttrMatches(attrFilters) {
  if (!Array.isArray(attrFilters) || attrFilters.length === 0) return {};

  const conditions = []; // یک شرطِ {$or:[محصول, واریانت]} برای هر ویژگی (با AND)

  for (const f of attrFilters) {
    const name = f?.name;
    if (!name) continue;
    const values = Array.isArray(f.values) ? f.values : [f.value];
    // هم عدد و هم رشته/regex، تا فیلدهای عددیِ ذخیره‌شده (مثلِ capacity) هم بخورند
    const matchers = values.flatMap(attrValueMatchers);
    if (matchers.length === 0) continue;

    // محصولاتی که دستِ‌کم یک واریانت با این مقدار دارند (منبعِ متغیر)
    const variantProductIds = await Variant.find({
      [`attributes.${name}`]: { $in: matchers },
    }).distinct("productId");

    conditions.push({
      $or: [
        { [`attributes.${name}`]: { $in: matchers } }, // منبعِ ثابت (روی محصول)
        { _id: { $in: variantProductIds } }, // منبعِ متغیر (روی واریانت)
      ],
    });
  }

  if (conditions.length === 0) return {};
  // همیشه داخلِ $and بسته‌بندی می‌شود تا با کلیدِ $orِ بخشِ «محصولات <برند>» در
  // fetchSectionProducts تداخل نکند (در غیرِ این صورت اسپردِ baseMatch آن را بازنویسی می‌کرد).
  return { $and: conditions };
}

function withinPrice(p, minPrice, maxPrice) {
  const price = p.finalPriceToman ?? p.basePriceToman ?? 0;
  if (typeof minPrice === "number" && minPrice > 0 && price < minPrice) return false;
  if (typeof maxPrice === "number" && maxPrice > 0 && price > maxPrice) return false;
  return true;
}

/**
 * ساختِ «فهرستِ بخش‌ها» — درختِ سری‌ها، شمارش، و دامنه‌ی سریِ هر بخش.
 *
 * عمداً به offset/limit/minPrice/maxPrice وابسته نیست: این‌ها فقط تعیین می‌کنند
 * کدام بخش‌ها در این batch واکشی شوند، نه اینکه فهرست چه باشد. در نتیجه با
 * unstable_cacheِ جداگانه، همه‌ی offsetهای یک ترکیبِ فیلتر یک ورودیِ کش مشترک
 * دارند و درختِ سری + aggregationِ شمارش به‌جای «هر batch یک‌بار»، فقط
 * «هر ترکیبِ فیلتر یک‌بار» اجرا می‌شود.
 *
 * خروجی شاملِ دو بخشِ سرور-only است که هرگز به کلاینت نمی‌رود:
 *   scopes       — { [key]: [serieId رشته‌ای] } دامنه‌ی سریِ هر بخش
 *   allSerieIds  — برای ساختِ شرطِ بخشِ «محصولات <برند>» (کلیدِ OTHER_KEY)
 */
async function _getBrandGroupedIndex(params) {
  const {
    brandId,
    sportId = null,
    categoryId = null,
    attrFilters = [],
    search = "",
    targetAudience = null,
  } = params || {};

  await connectToDB();

  const [
    { byId, roots, rootIdFor, descendantsByRoot },
    extra,
    relatedEditions,
    brand,
  ] = await Promise.all([
    buildSeriesTree(brandId),
    buildAttrMatches(attrFilters),
    getRelatedLimitedEditions(brandId),
    Brand.findById(toObjectId(brandId)).select("title name").lean(),
  ]);

  // هر همکاری به «برندِ مالکِ همان ادیشن» محدود می‌شود — همان قاعده‌ای که مسیرِ
  // /[brand]/[limitedEdition] اعمال می‌کند. جزئیات در utils/brandCollaboration.js.
  const collaborationScopes = buildCollaborationScopes(relatedEditions, brandId);

  const [baseMatch, brandlessBaseMatch] = await Promise.all([
    buildBaseMatch({ brandId, sportId, categoryId, search, extra, targetAudience }),
    collaborationScopes.length
      ? buildBaseMatch({
          brandId: null,
          sportId,
          categoryId,
          search,
          extra,
          targetAudience,
        })
      : Promise.resolve(null),
  ]);

  const collaborationMatch = brandlessBaseMatch
    ? buildCollaborationMatch(brandlessBaseMatch, collaborationScopes)
    : null;

  const [countAgg, collaborationCount] = await Promise.all([
    Product.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$serie", count: { $sum: 1 } } },
    ]),
    collaborationMatch
      ? Product.countDocuments(collaborationMatch)
      : Promise.resolve(0),
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

  // محصولاتِ همکاری بخشِ جداگانه‌ای ندارند؛ زیرِ همان بخشِ «محصولات <برند>» می‌آیند.
  otherCount += collaborationCount;

  // ── فهرستِ مرتب‌شده‌ی بخش‌های غیرخالی (ریشه‌ها به ترتیب order، سپس «سایر») ──
  const index = [];
  for (const root of roots) {
    const rid = root._id.toString();
    const c = countByRoot.get(rid) || 0;
    if (c > 0) {
      const resolved = resolveSerieSportContent(root, sportId);

      index.push({
        key: rid,
        serieId: rid,
        title: root.title || root.name || "",
        description: resolved.description,
        shortDescription: resolved.shortDescription,
        slug: root.slug || null,
        productCount: c,
        image: resolved.image || null,
        headImage: resolved.headImage || null,
        logo: root.logo || null,
      });
    }
  }
  if (otherCount > 0) {
    index.push({
      key: OTHER_KEY,
      serieId: null,
      title: otherSectionTitle(brand),
      description: "",
      shortDescription: "",
      slug: null,
      productCount: otherCount,
      image: null,
      headImage: null,
      logo: null,
    });
  }

  const totalCount = index.reduce((s, e) => s + e.productCount, 0);

  // دامنه‌ی سریِ هر بخش، رشته‌ای تا از unstable_cache سالم عبور کند
  const scopes = {};
  for (const entry of index) {
    if (entry.key === OTHER_KEY) continue;
    const ids = descendantsByRoot.get(entry.key) || [toObjectId(entry.key)];
    scopes[entry.key] = ids.filter(Boolean).map((id) => id.toString());
  }

  return JSON.parse(
    JSON.stringify({
      index,
      totalCount,
      scopes,
      allSerieIds: Array.from(byId.values()).map((s) => s._id.toString()),
      // سرور-only — بخشِ «سایر» با همین دامنه‌ها محصولاتِ همکاری را هم واکشی می‌کند
      collaborationScopes,
    })
  );
}

const getBrandGroupedIndex = unstable_cache(
  _getBrandGroupedIndex,
  [
    "brand-grouped-index",
    "target-audience-unisex-v1",
    // v2: همکاری‌ها بخشِ مستقل ندارند و به برندِ مالکِ ادیشن محدودند
    "limited-edition-relations-v3",
  ],
  { revalidate: 10800, tags: ["products", "categories", "series", "brands", "limited-editions"] }
);

async function _getBrandGroupedSections(params) {
  const {
    brandId,
    sportId = null,
    categoryId = null,
    attrFilters = [],
    offset = 0,
    productOffset = 0,
    limit = BRAND_SECTIONS_PER_BATCH,
    productLimit = BRAND_PRODUCTS_PER_BATCH,
    minPrice = 0,
    maxPrice = 0, // 0 یعنی بدون سقف
    search = "",
    withIndex = false,
    targetAudience = null,
  } = params || {};

  if (!brandId) {
    return {
      index: [],
      sections: [],
      nextOffset: 0,
      nextProductOffset: 0,
      hasMore: false,
      totalCount: 0,
    };
  }

  await connectToDB();

  // فهرست/شمارش از کشِ مستقل از offset می‌آید؛ extra فقط وقتی فیلترِ ویژگی فعال
  // است کوئری می‌زند (در مسیرِ رایج آرایه خالی است و هزینه‌ای ندارد).
  const [
    { index, totalCount, scopes, allSerieIds, collaborationScopes = [] },
    rate,
    extra,
  ] = await Promise.all([
    getBrandGroupedIndex({ brandId, sportId, categoryId, attrFilters, search, targetAudience }),
    getCachedRate(),
    buildAttrMatches(attrFilters),
  ]);

  const [baseMatch, brandlessBaseMatch] = await Promise.all([
    buildBaseMatch({ brandId, sportId, categoryId, search, extra, targetAudience }),
    collaborationScopes.length
      ? buildBaseMatch({
          brandId: null,
          sportId,
          categoryId,
          search,
          extra,
          targetAudience,
        })
      : Promise.resolve(null),
  ]);
  const allSerieOids = allSerieIds.map(toObjectId).filter(Boolean);
  const collaborationMatch = brandlessBaseMatch
    ? buildCollaborationMatch(brandlessBaseMatch, collaborationScopes)
    : null;

  const sectionFilter = (entry) => {
    if (entry.key === OTHER_KEY) {
      // محصولاتِ بدونِ سری (یا با سریِ یتیم) از خودِ این برند، به‌علاوه‌ی
      // محصولاتِ همکاری — یک کوئریِ واحد تا مرتب‌سازی و صفحه‌بندیِ بخش نشکند.
      const ownProducts = andMongoFilters(baseMatch, {
        $or: [
          { serie: null },
          { serie: { $exists: false } },
          { serie: { $nin: allSerieOids } },
        ],
      });
      return collaborationMatch
        ? { $or: [ownProducts, collaborationMatch] }
        : ownProducts;
    }
    const ids = (scopes[entry.key] || [entry.key]).map(toObjectId).filter(Boolean);
    return { ...baseMatch, serie: { $in: ids } };
  };

  // پروجکشن + populateهای باریکِ همان قراردادِ productListing.service — به‌جای
  // ارسالِ سندِ کاملِ محصول (که longDescription و همه‌ی فیلدهای صفحه‌ی جزئیات را
  // در هر کارت تکرار می‌کرد).
  const listingQuery = (filter, skip, take) => {
    let q = Product.find(filter).select(LISTING_FIELDS).sort({ order: 1, createdAt: -1 });
    for (const populate of POPULATES) q = q.populate(populate);
    return q.skip(skip).limit(take).lean();
  };

  // بودجه‌ی هر پاسخ بر اساس تعداد محصول است، نه اندازه‌ی بخش. چند بخش کوچک
  // می‌توانند یک batch را پر کنند و یک بخش بزرگ با productOffset در چند batch
  // ادامه پیدا می‌کند؛ بنابراین هیچ برند بزرگی payload چندده‌محصولی نمی‌سازد.
  const cursorPlan = planGroupedProductPage(index, {
    sectionOffset: offset,
    productOffset,
    sectionLimit: Math.min(
      Math.max(Number(limit) || BRAND_SECTIONS_PER_BATCH, 1),
      BRAND_SECTIONS_PER_BATCH,
    ),
    productLimit: Math.min(
      Math.max(Number(productLimit) || BRAND_PRODUCTS_PER_BATCH, 1),
      BRAND_PRODUCTS_PER_BATCH,
    ),
  });
  const rawPerPlan = await Promise.all(
    cursorPlan.plans.map(({ entry, skip, take }) =>
      listingQuery(sectionFilter(entry), skip, take),
    ),
  );
  const rawFlat = rawPerPlan.flat();
  const pricedFlat = rawFlat.length
    ? await attachListingPrices(rawFlat, rate)
    : [];
  const sections = [];
  let at = 0;

  for (let i = 0; i < cursorPlan.plans.length; i++) {
    const entry = cursorPlan.plans[i].entry;
    const priced = pricedFlat.slice(at, at + rawPerPlan[i].length);
    at += rawPerPlan[i].length;
    const products = priced.filter((product) =>
      withinPrice(product, minPrice, maxPrice),
    );
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

  return JSON.parse(
    JSON.stringify({
      index: withIndex ? index : undefined,
      sections,
      nextOffset: cursorPlan.nextOffset,
      nextProductOffset: cursorPlan.nextProductOffset,
      hasMore: cursorPlan.hasMore,
      totalCount,
    })
  );
}

export const getBrandGroupedSections = unstable_cache(
  _getBrandGroupedSections,
  [
    "brand-grouped-sections",
    "target-audience-unisex-v1",
    // v2: همکاری‌ها بخشِ مستقل ندارند و به برندِ مالکِ ادیشن محدودند
    "limited-edition-relations-v3",
    "brand-product-cursor-v1",
  ],
  { revalidate: 10800, tags: ["products", "categories", "series", "brands", "limited-editions"] }
);
