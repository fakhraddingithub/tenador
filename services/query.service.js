/**
 * services/query.service.js
 *
 * Direct (no HTTP) implementation of the /api/query logic.
 * Replaces server-to-self fetch calls in SSR pages with a cached function call.
 */

import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Serie from "base/models/Serie";
import LimitedEdition from "base/models/LimitedEdition";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

// سنتینل واحد برای ۴۰۴ — صفحه‌ی کنترلر با بررسی res.notFound === true تابع
// notFound() نکست را صدا می‌زند.
const NOT_FOUND = Object.freeze({ notFound: true });

/**
 * Deterministic Path Validator (ضدِ تله‌ی Soft-404 / Duplicate-Content).
 *
 * فقط ۷ الگوی دقیقِ زیر مجاز است؛ هر انحراف، سگمنتِ اضافی، یا جفتِ والد-فرزندِ
 * نامعتبر → notFound (بدونِ fallbackِ خاموش):
 *   1. /[sport]
 *   2. /[sport]/[category]            — category.sport === sport._id
 *   3. /[brand]                        — برندِ سراسری
 *   4. /[sport]/[brand]               — برند در این ورزش محصولِ فعال دارد
 *   5. /[sport]/[category]/[brand]    — دسته متعلق به ورزش + برند در این ترکیب محصول دارد
 *   6. /[sport]/[brand]/[serie]       — serie.brand === brand._id و در این ورزش محصول دارد
 *   7. /[brand]/[limitedEdition]      — limitedEdition.brand === brand._id و محصولِ فعال دارد
 *
 * نکته‌ی معماری: اعتبارسنجی مستقیماً روی مدل‌ها (موجودیت‌هایی که SlugRegistry به
 * آن‌ها اشاره می‌کند) انجام می‌شود، نه صرفاً روی اسلاگِ سراسریِ SlugRegistry؛ چون
 * اسلاگِ «دسته» اکنون per-sport است و جستجوی فقط-بر-اساس-اسلاگ در رجیستری مبهم
 * می‌شود. این تضمین می‌کند جفتِ والد-فرزند قطعی و بدونِ ابهام اعتبارسنجی شود.
 *
 * Serie فیلدِ sport ندارد؛ «مرتبط‌بودنِ سری با ورزش» از طریقِ وجودِ محصولِ
 * { sport, brand, serie } اثبات می‌شود (همان منطقِ «محصول در این ترکیب» برای
 * الگوهای ۴ و ۵).
 *
 * @returns موجودیت‌های resolve‌شده { sport?, brand?, category?, serie? } یا NOT_FOUND.
 */
/**
 * شناسه‌ی یک سریِ ریشه به‌علاوه‌ی شناسه‌ی همه‌ی فرزندانِ زیردرختش (در همین برند) را
 * برمی‌گرداند. همه‌ی سری‌های برند یک‌بار خوانده و زیردرخت با BFS پیمایش می‌شود تا
 * بررسیِ وجودِ محصول، محصولاتِ زیرسری‌ها را هم پوشش دهد.
 */
async function _collectSerieSubtreeIds(rootSerieId, brandId) {
  const all = await Serie.find({ brand: brandId })
    .select("_id parentSerie")
    .lean();

  const ids = [rootSerieId];
  const queue = [String(rootSerieId)];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const s of all) {
      if (s.parentSerie && String(s.parentSerie) === cur) {
        ids.push(s._id);
        queue.push(String(s._id));
      }
    }
  }
  return ids;
}

async function _validatePath(slugs) {
  // RULE 1: Array Length Hard Guard
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > 3) {
    return NOT_FOUND;
  }

  await connectToDB();
  const [s1, s2, s3] = slugs.map((s) => String(s));

  let resolved = NOT_FOUND;

  // RULE 2: State-Machine Resolution
  if (slugs.length === 1) {
    // ریشه فقط می‌تواند SPORT (الگوی ۱) یا BRAND (الگوی ۳) باشد
    const sport = await Sport.findOne({ slug: s1 }).lean();
    if (sport) {
      resolved = { sport };
    } else {
      const brand = await Brand.findOne({ slug: s1 }).lean();
      if (brand) resolved = { brand };
    }
  } else if (slugs.length === 2) {
    // s1 معمولاً SPORT است (الگوهای ۲ و ۴). در غیر این صورت ممکن است برندی باشد
    // که لیمیتد ادیشنِ خود را سرو می‌کند (الگوی ۷: /[brand]/[limitedEdition]).
    const sport = await Sport.findOne({ slug: s1 }).lean();
    if (sport) {
      // دسته در محدوده‌ی همین ورزش (الگوی ۲)
      const category = await Category.findOne({ slug: s2, sport: sport._id }).lean();
      if (category) {
        resolved = { sport, category };
      } else {
        // برند با محصولِ فعال در این ورزش (الگوی ۴)
        const brand = await Brand.findOne({ slug: s2 }).lean();
        if (
          brand &&
          (await Product.exists({ sport: sport._id, brand: brand._id, isActive: true }))
        ) {
          resolved = { sport, brand };
        }
      }
    } else {
      // الگوی ۷: /[brand]/[limitedEdition] — لیمیتد ادیشنِ متعلق به همین برند با
      // حداقل یک محصولِ فعال. لیمیتد ادیشن‌ها برند-محور هستند (مستقل از ورزش).
      const brand = await Brand.findOne({ slug: s1 }).lean();
      if (brand) {
        const limitedEdition = await LimitedEdition.findOne({ slug: s2 }).lean();
        if (
          limitedEdition &&
          String(limitedEdition.brand) === String(brand._id) &&
          (await Product.exists({
            brand: brand._id,
            limitedEdition: limitedEdition._id,
            isActive: true,
          }))
        ) {
          resolved = { brand, limitedEdition };
        }
      }
    }
  } else {
    // slugs.length === 3 — s1 باید حتماً SPORT باشد
    const sport = await Sport.findOne({ slug: s1 }).lean();
    if (sport) {
      const category = await Category.findOne({ slug: s2, sport: sport._id }).lean();
      if (category) {
        // Branch A (الگوی ۵): s3 باید BRAND باشد با محصول در ترکیبِ ورزش+دسته
        const brand = await Brand.findOne({ slug: s3 }).lean();
        if (
          brand &&
          (await Product.exists({
            sport: sport._id,
            category: category._id,
            brand: brand._id,
            isActive: true,
          }))
        ) {
          resolved = { sport, category, brand };
        }
      } else {
        // Branch B (الگوی ۶): s2 باید BRAND و s3 باید SERIE متعلق به این برند+ورزش
        const brand = await Brand.findOne({ slug: s2 }).lean();
        if (brand) {
          const serie = await Serie.findOne({ slug: s3 }).lean();
          if (serie && String(serie.brand) === String(brand._id)) {
            // یک سریِ ریشه ممکن است محصولِ مستقیم نداشته باشد و همه‌ی محصولاتش روی
            // زیرسری‌ها باشند. پس «مرتبط‌بودنِ سری با این ورزش» با وجودِ محصول روی
            // کلِ زیردرختِ سری (خودش + همه‌ی فرزندان) اثبات می‌شود، نه فقط خودِ سری —
            // وگرنه صفحه‌ی سریِ والدِ بدونِ محصولِ مستقیم به‌اشتباه ۴۰۴ می‌شد.
            const serieIds = await _collectSerieSubtreeIds(serie._id, brand._id);
            if (
              await Product.exists({
                sport: sport._id,
                brand: brand._id,
                serie: { $in: serieIds },
                isActive: true,
              })
            ) {
              const sportOverride = (serie.sportImages || []).find(
                (entry) => entry?.sport && String(entry.sport) === String(sport._id)
              );
              const resolvedSerie = sportOverride
                ? {
                    ...serie,
                    image: sportOverride.image || serie.image,
                    headImage: sportOverride.headImage || serie.headImage,
                  }
                : serie;
              resolved = { sport, brand, serie: resolvedSerie };
            }
          }
        }
      }
    }
  }

  if (resolved.notFound) return NOT_FOUND;

  // RULE 3: Mirror Reconstruction Test — مسیرِ بازساخته از موجودیت‌های resolve‌شده
  // باید کاراکتر-به-کاراکتر برابرِ مسیرِ درخواستی باشد. هر اختلاف (سگمنتِ کم/زیاد،
  // ترتیب، یا اسلاگِ غیرکانونیک) → ۴۰۴، بدونِ fallbackِ خاموش.
  const canonical = _canonicalSegments(resolved);
  if (slugs.join("/") !== canonical.join("/")) return NOT_FOUND;

  return resolved;
}

/**
 * بازساختِ سگمنت‌های کانونیکِ URL از موجودیت‌های resolve‌شده، به ترتیبِ دقیقِ الگو.
 */
function _canonicalSegments(r) {
  const segs = [];
  if (r.sport) segs.push(r.sport.slug);
  if (!r.sport && r.brand) segs.push(r.brand.slug); // برندِ سراسری (الگوی ۳)
  if (r.category) segs.push(r.category.slug);
  if (r.sport && r.brand) segs.push(r.brand.slug); // الگوهای ۴ و ۵
  if (r.serie) segs.push(r.serie.slug);
  if (r.limitedEdition) segs.push(r.limitedEdition.slug); // الگوی ۷: /[brand]/[limitedEdition]
  return segs;
}

/**
 * Adapter: نتیجه‌ی validatorِ سخت‌گیر را به شکلِ { search, filters } برای مصرف‌کننده‌ها
 * در می‌آورد (یا NOT_FOUND). search داکیومنت‌های خام با ObjectId است؛ filters شیِ
 * نمایشی (با brandStats روی برند). فقط موجودیت‌هایی پر می‌شوند که بخشی از الگوی
 * معتبر باشند — athlete/product در الگوهای مجاز جایی ندارند. limitedEdition فقط در
 * الگوی ۷ (/[brand]/[limitedEdition]) پر می‌شود.
 */
async function _resolveContext(slugs) {
  const resolved = await _validatePath(slugs);
  if (resolved.notFound) return NOT_FOUND;

  const search = {
    brand: resolved.brand || null,
    sport: resolved.sport || null,
    athlete: null,
    category: resolved.category || null,
    serie: resolved.serie || null,
    limitedEdition: resolved.limitedEdition || null,
    product: null,
  };

  // آمار برند (سری‌ها + تعداد محصول) — برای هدرِ صفحاتِ برند/سری
  let brandStats = null;
  if (search.brand) {
    const [totalBrandProducts, fullBrand] = await Promise.all([
      Product.countDocuments({ brand: search.brand._id, isActive: true }),
      Brand.findById(search.brand._id)
        .populate({ path: "series", options: { sort: { order: 1, createdAt: -1 } } })
        .lean(),
    ]);

    const seriesWithCounts = await Promise.all(
      (fullBrand?.series || []).map(async (serie) => {
        const count = await Product.countDocuments({ serie: serie._id, isActive: true });
        return { ...serie, productCount: count };
      })
    );

    brandStats = { ...search.brand, totalProductCount: totalBrandProducts, series: seriesWithCounts };
  }

  const filters = {
    brand: brandStats || search.brand,
    sport: search.sport,
    athlete: null,
    category: search.category,
    serie: search.serie,
    limitedEdition: search.limitedEdition,
    product: null,
  };

  return { notFound: false, search, filters };
}

async function _queryBySlugs(slugs) {
  const ctx = await _resolveContext(slugs);
  if (ctx.notFound) return NOT_FOUND;

  const { search, filters } = ctx;

  const finalFilter = { isActive: true };
  if (search.brand) finalFilter.brand = search.brand._id;
  if (search.sport) finalFilter.sport = search.sport._id;
  if (search.category) finalFilter.category = search.category._id;
  if (search.serie) finalFilter.serie = search.serie._id;
  if (search.limitedEdition) finalFilter.limitedEdition = search.limitedEdition._id;

  // ⚠️ variants باید populate شوند تا سوآچ‌های تصویر واریانت روی کارت محصول
  //   نمایش داده شوند — دقیقاً مثل صفحه‌ی اصلی ورزش (getPageDataBySlug). بدون این،
  //   product.variants فقط آرایه‌ای از ObjectId است و کارت هیچ سوآچی نشان نمی‌دهد.
  const products = await Product.find(finalFilter)
    .populate("brand sport athlete category serie limitedEdition variants")
    .sort({ createdAt: -1 })
    .lean();

  // قیمت‌ها سمت سرور و دسته‌ای محاسبه می‌شوند تا کارت‌ها price-API نزنند
  const rate = await getCachedRate();
  const priced = await attachListingPrices(products, rate);

  return JSON.parse(
    JSON.stringify({
      notFound: false,
      filters,
      results: priced,
      totalResults: priced.length,
    })
  );
}

export const queryBySlugs = unstable_cache(
  _queryBySlugs,
  ["query-by-slugs"],
  { revalidate: 60, tags: ["products", "sports", "categories", "brands", "series", "limited-editions"] }
);

/**
 * فقط موجودیت‌های صفحه (filters) — بدون بارگذاری محصولات.
 * برای صفحه‌ی برند (نمای گروه‌بندی‌شده + infinite scroll) استفاده می‌شود تا
 * بارِ اولیه سبک بماند و همه‌ی محصولات یک‌جا لود نشوند.
 */
export const resolvePageContext = unstable_cache(
  async (slugs) => {
    const ctx = await _resolveContext(slugs);
    if (ctx.notFound) return { notFound: true };
    return JSON.parse(JSON.stringify({ notFound: false, filters: ctx.filters }));
  },
  ["resolve-page-context"],
  { revalidate: 60, tags: ["products", "sports", "categories", "brands", "series", "limited-editions"] }
);
