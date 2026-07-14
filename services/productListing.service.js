import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

export const STOREFRONT_PAGE_SIZE = 20;
export const STOREFRONT_MAX_PAGE_SIZE = 60;

// Detail-only fields must not be serialized into every product card.
const LISTING_FIELDS = [
  "name", "slug", "shortDescription", "basePrice", "label", "mainImage",
  "gallery", "brand", "sport", "athlete", "category", "serie", "limitedEdition",
  "attributes", "variantMeta", "variants", "order",
].join(" ");

const POPULATES = [
  { path: "brand", select: "name title slug icon logo" },
  { path: "sport", select: "name title slug image headImage" },
  { path: "athlete", select: "name title slug image" },
  { path: "category", select: "name title slug" },
  { path: "serie", select: "name title slug level" },
  { path: "limitedEdition", select: "name title slug" },
  { path: "variants", select: "sku price attributes images stock isActive" },
];

export function sanitizeListingFilter(input = {}) {
  const filter = { isActive: true };
  for (const key of ["sport", "category", "brand", "athlete", "serie", "limitedEdition"]) {
    const value = input[key];
    if (!value) continue;
    if (!mongoose.isValidObjectId(value)) {
      throw new TypeError(`Invalid product listing filter: ${key}`);
    }
    filter[key] = value;
  }
  return filter;
}

export async function getProductListingPage({ filter = {}, offset = 0, limit = STOREFRONT_PAGE_SIZE } = {}) {
  await connectToDB();

  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(
    STOREFRONT_MAX_PAGE_SIZE,
    Math.max(1, Number(limit) || STOREFRONT_PAGE_SIZE),
  );
  const safeFilter = sanitizeListingFilter(filter);

  let productsQuery = Product.find(safeFilter)
    .select(LISTING_FIELDS)
    .sort({ order: 1, createdAt: -1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .lean();

  for (const populate of POPULATES) productsQuery = productsQuery.populate(populate);

  const [products, totalResults, rate] = await Promise.all([
    productsQuery,
    Product.countDocuments(safeFilter),
    getCachedRate(),
  ]);
  const priced = await attachListingPrices(products, rate);

  return JSON.parse(JSON.stringify({
    products: priced,
    totalResults,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + priced.length < totalResults,
  }));
}
