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

const entities = ["brand", "sport", "athlete", "category", "serie", "product"];
const modelMap = { brand: Brand, sport: Sport, athlete: Athlete, category: Category, serie: Serie, product: Product };

async function _queryBySlugs(slugs) {
  await connectToDB();

  const search = { brand: null, sport: null, athlete: null, category: null, serie: null, product: null };

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
      Brand.findById(search.brand._id).populate("series").lean(),
    ]);

    const seriesWithCounts = await Promise.all(
      (fullBrand.series || []).map(async (serie) => {
        const count = await Product.countDocuments({ serie: serie._id, isActive: true });
        return { ...serie, productCount: count };
      })
    );

    brandStats = { ...search.brand, totalProductCount: totalBrandProducts, series: seriesWithCounts };
  }

  const finalFilter = { isActive: true };
  if (search.brand) finalFilter.brand = search.brand._id;
  if (search.sport) finalFilter.sport = search.sport._id;
  if (search.athlete) finalFilter.athlete = search.athlete._id;
  if (search.category) finalFilter.category = search.category._id;
  if (search.serie) finalFilter.serie = search.serie._id;
  if (search.product) finalFilter._id = search.product._id;

  const products = await Product.find(finalFilter)
    .populate("brand sport athlete category serie")
    .sort({ createdAt: -1 })
    .lean();

  return JSON.parse(
    JSON.stringify({
      filters: {
        brand: brandStats || search.brand,
        sport: search.sport,
        athlete: search.athlete,
        category: search.category,
        serie: search.serie,
        product: search.product,
      },
      results: products,
      totalResults: products.length,
    })
  );
}

export const queryBySlugs = unstable_cache(
  _queryBySlugs,
  ["query-by-slugs"],
  { revalidate: 60, tags: ["products", "sports", "categories", "brands", "series"] }
);
