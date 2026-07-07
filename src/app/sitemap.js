import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";

import connectToDB from "base/configs/db";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

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

  return [
    ...staticPages,
    ...sportUrls,
    ...productUrls,
    ...categoryUrls,
    ...brandUrls,
  ];
}