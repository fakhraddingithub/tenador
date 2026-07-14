import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import ArticleCategory from "base/models/ArticleCategory";
import ArticleRedirect from "base/models/ArticleRedirect";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Serie from "base/models/Serie";
import Sport from "base/models/Sport";
import UsedProduct from "base/models/UsedProduct";
import { buildArticlePath, normalizeArticleSlug } from "base/utils/articleSlug";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";
import { isReservedArticleRoot, publicArticleFilter } from "base/utils/articleRoutes";


const ids = (value) => [...new Set((Array.isArray(value) ? value : value ? [value] : [])
  .map(String).filter((id) => mongoose.isValidObjectId(id)))];
const serialise = (value) => JSON.parse(JSON.stringify(value));
async function rootSlugIsOccupied(slug) {
  if (isReservedArticleRoot(slug)) return true;
  const [sport, brand] = await Promise.all([Sport.exists({ slug }), Brand.exists({ slug })]);
  return Boolean(sport || brand);
}

function collectBlockReferences(blocks = []) {
  const refs = { products: [], brands: [], series: [], categories: [], sports: [], articles: [], usedProducts: [] };
  for (const block of blocks) {
    const data = block?.data || {};
    if (block.type === "productCard") refs.products.push(...ids(data.product));
    if (block.type === "productSlider") refs.products.push(...ids(data.products));
    if (block.type === "brandSlider") refs.brands.push(...ids(data.brands));
    if (block.type === "collectionSlider") refs.series.push(...ids(data.collections));
    if (block.type === "categorySlider") refs.categories.push(...ids(data.categories));
    if (block.type === "sportSlider") refs.sports.push(...ids(data.sports));
    if (block.type === "relatedArticles") refs.articles.push(...ids(data.articles));
    if (block.type === "usedProducts") refs.usedProducts.push(...ids(data.products));
  }
  for (const key of Object.keys(refs)) refs[key] = [...new Set(refs[key])];
  return refs;
}

export async function resolveArticleEntities(article) {
  const refs = collectBlockReferences(article.blocks);
  const dynamicBlocks = (article.blocks || []).filter((block) =>
    ["latestProducts", "bestSellers", "amazingOffers"].includes(block.type));

  const [rate, products, brands, series, categories, sports, articles, usedProducts, dynamicProducts] = await Promise.all([
    refs.products.length || dynamicBlocks.length ? getCachedRate() : Promise.resolve(1),
    refs.products.length ? Product.find({ _id: { $in: refs.products }, isActive: true }).populate("brand category variants").lean() : [],
    refs.brands.length ? Brand.find({ _id: { $in: refs.brands } }).select("name title slug logo image icon").lean() : [],
    refs.series.length ? Serie.find({ _id: { $in: refs.series } }).select("name title slug logo image headImage brand").populate("brand", "slug title name").lean() : [],
    refs.categories.length ? Category.find({ _id: { $in: refs.categories } }).select("name title slug image icon sport").populate("sport", "slug title name").lean() : [],
    refs.sports.length ? Sport.find({ _id: { $in: refs.sports } }).select("name title slug image icon").lean() : [],
    refs.articles.length ? Article.find({ _id: { $in: refs.articles }, ...publicArticleFilter() }).select("title slug excerpt cover category publishedAt readingTime").populate("category", "name slug status").lean() : [],
    refs.usedProducts.length ? UsedProduct.find({ _id: { $in: refs.usedProducts }, status: { $ne: "sold" } }).populate({ path: "baseProduct", select: "mainImage brand", populate: { path: "brand", select: "title icon" } }).lean() : [],
    Promise.all(dynamicBlocks.map(async (block) => {
      const data = block.data || {};
      const limit = Math.min(16, Math.max(1, Number(data.limit) || 8));
      const query = { isActive: true };
      if (ids(data.sports).length) query.sport = { $in: ids(data.sports) };
      if (ids(data.categories).length) query.category = { $in: ids(data.categories) };
      if (block.type === "bestSellers") query.label = "best_seller";
      if (block.type === "amazingOffers") query.label = "discount";
      const docs = await Product.find(query).sort({ createdAt: -1 }).limit(limit).populate("brand category variants").lean();
      return [String(block.id), docs];
    })),
  ]);

  const allProducts = [...products, ...dynamicProducts.flatMap(([, list]) => list)];
  const uniqueProducts = [...new Map(allProducts.map((item) => [String(item._id), item])).values()];
  const pricedProducts = uniqueProducts.length ? await attachListingPrices(uniqueProducts, rate) : [];
  const productMap = Object.fromEntries(pricedProducts.map((item) => [String(item._id), item]));
  const dynamicMap = Object.fromEntries(dynamicProducts.map(([blockId, list]) => [blockId, list.map((item) => productMap[String(item._id)]).filter(Boolean)]));

  const maps = {};
  for (const [key, list] of Object.entries({ products: pricedProducts, brands, series, categories, sports, articles, usedProducts })) {
    maps[key] = Object.fromEntries(list.map((item) => [String(item._id), item]));
  }
  return serialise({ rate, maps, dynamicProducts: dynamicMap });
}

async function getCategoryInternal(slug) {
  await connectToDB();
  const normalizedSlug = normalizeArticleSlug(slug);
  if (await rootSlugIsOccupied(normalizedSlug)) return null;
  const category = await ArticleCategory.findOne({ slug: normalizedSlug, status: "active" }).lean();
  if (!category) return null;
  const articles = await Article.find({ category: category._id, ...publicArticleFilter() })
    .select("title slug excerpt cover author publishedAt updatedAt readingTime featured pinned tags")
    .populate("author", "name lastName avatar")
    .populate("tags", "name slug")
    .sort({ pinned: -1, featured: -1, publishedAt: -1 })
    .limit(48)
    .lean();
  return serialise({ category, articles });
}

async function getArticleInternal(categorySlug, articleSlug) {
  await connectToDB();
  const normalizedCategorySlug = normalizeArticleSlug(categorySlug);
  if (await rootSlugIsOccupied(normalizedCategorySlug)) return null;
  const category = await ArticleCategory.findOne({ slug: normalizedCategorySlug, status: "active" }).lean();
  if (category) {
    const article = await Article.findOne({ category: category._id, slug: normalizeArticleSlug(articleSlug), ...publicArticleFilter() })
      .populate("category", "name slug description seo cover")
      .populate("author", "name lastName avatar")
      .populate("tags", "name slug")
      .lean();
    if (article) {
      const tagIds = (article.tags || []).map((tag) => tag._id);
      const relatedFilter = { _id: { $ne: article._id }, ...publicArticleFilter(), $and: [{ $or: [{ category: category._id }, ...(tagIds.length ? [{ tags: { $in: tagIds } }] : [])] }] };
      const [entities, relatedArticles] = await Promise.all([
        resolveArticleEntities(article),
        Article.find(relatedFilter).select("title slug excerpt cover category publishedAt readingTime").populate("category", "name slug").sort({ pinned: -1, publishedAt: -1 }).limit(4).lean(),
      ]);
      return serialise({ kind: "article", article, relatedArticles, entities });
    }
  }

  const redirect = await ArticleRedirect.findOne({ fromCategorySlug: normalizedCategorySlug, fromArticleSlug: normalizeArticleSlug(articleSlug), active: true }).lean();
  if (!redirect) return null;
  const target = await Article.findOne({ _id: redirect.article, ...publicArticleFilter() }).select("slug category").populate("category", "slug status").lean();
  if (!target || target.category?.status !== "active") return null;
  return { kind: "redirect", statusCode: redirect.statusCode, location: buildArticlePath(target.category.slug, target.slug) };
}

export const getPublicArticleCategory = unstable_cache(getCategoryInternal, ["public-article-category"], { revalidate: 300, tags: ["articles"] });
export const getPublicArticle = unstable_cache(getArticleInternal, ["public-article"], { revalidate: 300, tags: ["articles", "products", "categories", "brands", "sports", "series"] });

export const getPublicArticleSitemap = unstable_cache(async () => {
  await connectToDB();
  const [categories, articles] = await Promise.all([
    ArticleCategory.find({ status: "active", "seo.noIndex": { $ne: true } }).select("slug updatedAt").lean(),
    Article.find({ ...publicArticleFilter(), "seo.noIndex": { $ne: true } }).select("slug category updatedAt publishedAt").populate("category", "slug status").lean(),
  ]);
  return serialise({ categories, articles: articles.filter((article) => article.category?.status === "active") });
}, ["public-article-sitemap"], { revalidate: 3600, tags: ["articles"] });

export const getPublicArticleFeed = unstable_cache(async () => {
  await connectToDB();
  const [articles, sports, brands] = await Promise.all([
    Article.find({ ...publicArticleFilter(), "seo.noIndex": { $ne: true } }).select("title slug excerpt cover category publishedAt updatedAt author").populate("category", "name slug status").populate("author", "name lastName").sort({ publishedAt: -1 }).limit(50).lean(),
    Sport.find({}).select("slug").lean(),
    Brand.find({}).select("slug").lean(),
  ]);
  const occupied = new Set([...sports, ...brands].map((item) => item.slug).filter(Boolean));
  return serialise(articles.filter((article) => article.category?.status === "active" && !occupied.has(article.category.slug) && !isReservedArticleRoot(article.category.slug)));
}, ["public-article-feed"], { revalidate: 900, tags: ["articles"] });

export const getPublicArticleHub = unstable_cache(async () => {
  await connectToDB();
  const [categories, articles, sports, brands] = await Promise.all([
    ArticleCategory.find({ status: "active" }).select("name slug description cover order updatedAt").sort({ order: 1, name: 1 }).lean(),
    Article.find(publicArticleFilter()).select("title slug excerpt cover category publishedAt updatedAt readingTime featured pinned").populate("category", "name slug status").sort({ pinned: -1, featured: -1, publishedAt: -1 }).limit(24).lean(),
    Sport.find({}).select("slug").lean(),
    Brand.find({}).select("slug").lean(),
  ]);
  const occupied = new Set([...sports, ...brands].map((item) => item.slug).filter(Boolean));
  for (const category of categories) if (isReservedArticleRoot(category.slug)) occupied.add(category.slug);
  return serialise({
    categories: categories.filter((category) => !occupied.has(category.slug)),
    articles: articles.filter((article) => article.category?.status === "active" && !occupied.has(article.category.slug)),
  });
}, ["public-article-hub"], { revalidate: 300, tags: ["articles"] });

export const getLegacyArticleTarget = unstable_cache(async (value) => {
  await connectToDB();
  if (!mongoose.isValidObjectId(value)) return null;
  const article = await Article.findOne({ _id: value, ...publicArticleFilter() }).select("slug category").populate("category", "slug status").lean();
  if (!article || article.category?.status !== "active") return null;
  const occupied = await Promise.all([Sport.exists({ slug: article.category.slug }), Brand.exists({ slug: article.category.slug })]);
  return isReservedArticleRoot(article.category.slug) || occupied.some(Boolean) ? null : buildArticlePath(article.category.slug, article.slug);
}, ["legacy-public-article"], { revalidate: 300, tags: ["articles"] });