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

const entities = ["brand", "sport", "athlete", "category", "serie", "limitedEdition", "product"];
const modelMap = { brand: Brand, sport: Sport, athlete: Athlete, category: Category, serie: Serie, limitedEdition: LimitedEdition, product: Product };

/**
 * تشخیص موجودیت‌های صفحه از روی اسلاگ‌ها + آمار برند (سری‌ها و تعداد محصول).
 * محصولات را بارگذاری نمی‌کند — سبک و مناسب برای تصمیم‌گیری نوع صفحه.
 * خروجی شاملِ search (داکیومنت‌های خام با ObjectId) و filters (شیِ نمایشی) است.
 */
async function _resolveContext(slugs) {
  await connectToDB();

  const search = { brand: null, sport: null, athlete: null, category: null, serie: null, limitedEdition: null, product: null };

  for (const slug of slugs) {
    for (const entity of entities) {
      if (!search[entity]) {
        const conditions = { slug };
        if (entity === "product") conditions.isActive = true;
        const doc = await modelMap[entity].findOne(conditions).lean();
        if (doc) {
          search[entity] = doc;
          break;
        }
      }
    }
  }

  let brandStats = null;
  if (search.brand) {
    const [totalBrandProducts, fullBrand] = await Promise.all([
      Product.countDocuments({ brand: search.brand._id, isActive: true }),
      Brand.findById(search.brand._id)
        .populate({ path: "series", options: { sort: { order: 1, createdAt: -1 } } })
        .lean(),
    ]);

    const seriesWithCounts = await Promise.all(
      (fullBrand.series || []).map(async (serie) => {
        const count = await Product.countDocuments({ serie: serie._id, isActive: true });
        return { ...serie, productCount: count };
      })
    );

    brandStats = { ...search.brand, totalProductCount: totalBrandProducts, series: seriesWithCounts };
  }

  const filters = {
    brand: brandStats || search.brand,
    sport: search.sport,
    athlete: search.athlete,
    category: search.category,
    serie: search.serie,
    limitedEdition: search.limitedEdition,
    product: search.product,
  };

  return { search, filters };
}

async function _queryBySlugs(slugs) {
  const { search, filters } = await _resolveContext(slugs);

  const finalFilter = { isActive: true };
  if (search.brand) finalFilter.brand = search.brand._id;
  if (search.sport) finalFilter.sport = search.sport._id;
  if (search.athlete) finalFilter.athlete = search.athlete._id;
  if (search.category) finalFilter.category = search.category._id;
  if (search.serie) finalFilter.serie = search.serie._id;
  if (search.limitedEdition) finalFilter.limitedEdition = search.limitedEdition._id;
  if (search.product) finalFilter._id = search.product._id;

  const products = await Product.find(finalFilter)
    .populate("brand sport athlete category serie limitedEdition")
    .sort({ createdAt: -1 })
    .lean();

  // قیمت‌ها سمت سرور و دسته‌ای محاسبه می‌شوند تا کارت‌ها price-API نزنند
  const rate = await getCachedRate();
  const priced = await attachListingPrices(products, rate);

  return JSON.parse(
    JSON.stringify({
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
    const { filters } = await _resolveContext(slugs);
    return JSON.parse(JSON.stringify(filters));
  },
  ["resolve-page-context"],
  { revalidate: 60, tags: ["products", "sports", "categories", "brands", "series", "limited-editions"] }
);
