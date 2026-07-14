import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";

import connectToDB from "base/configs/db";
import { getPublicArticleSitemap } from "base/services/publicArticle.service";
import { isReservedArticleRoot } from "base/utils/articleRoutes";
import { buildArticlePath } from "base/utils/articleSlug";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export const revalidate = 86400;

export default async function sitemap() {
  await connectToDB();

  // -------------------------
  // Products
  // -------------------------
  const products = await Product.find({})
    .select("slug updatedAt")
    .lean();

  // -------------------------
  // Sports
  // -------------------------
  const sports = await Sport.find({})
    .select("slug updatedAt")
    .lean();

  // -------------------------
  // Categories (تو-در-توی ورزش: /[sportSlug]/[categorySlug])
  // -------------------------
  const categories = await Category.find({})
    .select("slug updatedAt sport")
    .populate("sport", "slug")
    .lean();

  // -------------------------
  // Brands
  // -------------------------
  const brands = await Brand.find({})
    .select("slug updatedAt")
    .lean();

  // -------------------------
  // Static Pages
  // -------------------------
  const articleContent = await getPublicArticleSitemap();
  const occupiedRootSlugs = new Set([...sports, ...brands].map((item) => item.slug).filter(Boolean));

  const staticPages = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },

    {
      url: `${SITE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },

    {
      url: `${SITE_URL}/brands`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // -------------------------
  // Sport URLs — /[sportSlug]
  // -------------------------
  const sportUrls = sports
    .filter((s) => s.slug)
    .map((sport) => ({
      url: `${SITE_URL}/${sport.slug}`,
      lastModified: sport.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  // -------------------------
  // Product URLs
  // -------------------------
  const productUrls = products.map((product) => ({
    url: `${SITE_URL}/products/${product.slug}`,

    lastModified: product.updatedAt,

    changeFrequency: "weekly",

    priority: 0.8,
  }));

  // -------------------------
  // Category URLs — تو-در-توی ورزش: /[sportSlug]/[categorySlug]
  // دسته‌های بدون ورزش (داده‌ی قدیمی) مسیر معتبری ندارند و رد می‌شوند.
  // -------------------------
  const categoryUrls = categories
    .filter((category) => category.sport?.slug && category.slug)
    .map((category) => ({
      url: `${SITE_URL}/${category.sport.slug}/${category.slug}`,

      lastModified: category.updatedAt,

      changeFrequency: "weekly",

      priority: 0.7,
    }));

  // -------------------------
  // Brand URLs
  // -------------------------
  const brandUrls = brands.map((brand) => ({
    url: `${SITE_URL}/brand/${brand.slug}`,

    lastModified: brand.updatedAt,

    changeFrequency: "weekly",

    priority: 0.6,
  }));

  const articleCategoryUrls = articleContent.categories
    .filter((category) => category.slug && !occupiedRootSlugs.has(category.slug) && !isReservedArticleRoot(category.slug))
    .map((category) => ({
      url: `${SITE_URL}/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const articleUrls = articleContent.articles
    .filter((article) => article.slug && article.category?.slug && !occupiedRootSlugs.has(article.category.slug) && !isReservedArticleRoot(article.category.slug))
    .map((article) => ({
      url: `${SITE_URL}${buildArticlePath(article.category.slug, article.slug)}`,
      lastModified: article.updatedAt || article.publishedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  return [
    ...staticPages,
    ...sportUrls,
    ...productUrls,
    ...categoryUrls,
    ...brandUrls,
    ...articleCategoryUrls,
    ...articleUrls,
  ];
}
