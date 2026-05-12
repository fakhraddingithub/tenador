import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";

import connectToDB from "base/configs/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export default async function sitemap() {
  await connectToDB();

  // -------------------------
  // Products
  // -------------------------
  const products = await Product.find({})
    .select("slug updatedAt")
    .lean();

  // -------------------------
  // Categories
  // -------------------------
  const categories = await Category.find({})
    .select("slug updatedAt")
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
      url: `${SITE_URL}/category`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },

    {
      url: `${SITE_URL}/brands`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

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
  // Category URLs
  // -------------------------
  const categoryUrls = categories.map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,

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
    ...productUrls,
    ...categoryUrls,
    ...brandUrls,
  ];
}