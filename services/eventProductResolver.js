/**
 * Resolves an event's product selection rules into a list of priced products.
 *
 * Rules are evaluated independently and their results combined:
 *  - include rules add products to the result set
 *  - exclude rules remove products from the result set
 *
 * If no include rule is present all active products are used as the base set.
 *
 * Prices are attached through the canonical priceEngine (attachListingPrices),
 * so event cards expose the same fields the rest of the site uses
 * (basePriceToman / finalPriceToman / discountPercent / hasQuantityDiscount) and
 * never need a per-card price API call.
 */

import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import DiscountRule from "base/models/DiscountRule";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

/**
 * Normalizes a rule value into an array of trimmed strings.
 * Accepts: arrays, comma-separated strings, populated `{ _id }` objects,
 * or raw ObjectIds. Empty/blank entries are dropped.
 */
function toArray(value) {
  if (value === null || value === undefined || value === "") return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [value];
  return raw
    .map((v) => (v && typeof v === "object" && v._id ? v._id : v))
    .map((v) => (v === null || v === undefined ? "" : v.toString().trim()))
    .filter(Boolean);
}

/** Keeps only well-formed ObjectId strings (guards against typed names). */
function toObjectIds(value) {
  return toArray(value).filter((id) => mongoose.Types.ObjectId.isValid(id));
}

/**
 * Returns product ids that match the conditions of the given DiscountRules.
 * Mirrors how priceEngine maps a rule to products (global / product / brand /
 * category / serie) so an event stays in sync with the discount it advertises.
 * Rule types that aren't product-targetable (variant / userRole / userLevel /
 * cartValue) are ignored here.
 */
async function resolveDiscountRuleProducts(ruleIds) {
  const ids = toObjectIds(ruleIds);
  if (!ids.length) return [];

  const rules = await DiscountRule.find({ _id: { $in: ids } })
    .select("type targets")
    .lean();
  if (!rules.length) return [];

  const productTargets = [];
  const brandTargets = [];
  const categoryTargets = [];
  const serieTargets = [];
  let hasGlobal = false;

  for (const r of rules) {
    const targets = r.targets || [];
    if (r.type === "global") hasGlobal = true;
    else if (r.type === "product") productTargets.push(...targets);
    else if (r.type === "brand") brandTargets.push(...targets);
    else if (r.type === "category") categoryTargets.push(...targets);
    else if (r.type === "serie") serieTargets.push(...targets);
  }

  // A global discount applies to every active product.
  if (hasGlobal) {
    const docs = await Product.find({ isActive: true }).select("_id").lean();
    return docs.map((d) => d._id.toString());
  }

  const or = [];
  if (productTargets.length) or.push({ _id: { $in: productTargets } });
  if (brandTargets.length) or.push({ brand: { $in: brandTargets } });
  if (categoryTargets.length) or.push({ category: { $in: categoryTargets } });
  if (serieTargets.length) or.push({ serie: { $in: serieTargets } });
  if (!or.length) return [];

  const docs = await Product.find({ isActive: true, $or: or })
    .select("_id")
    .lean();
  return docs.map((d) => d._id.toString());
}

async function resolveRule(rule) {
  const { type, value } = rule;

  switch (type) {
    case "manual":
      return toObjectIds(value);

    case "category": {
      const ids = toObjectIds(value);
      if (!ids.length) return [];
      const docs = await Product.find({ category: { $in: ids }, isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "brand": {
      const ids = toObjectIds(value);
      if (!ids.length) return [];
      const docs = await Product.find({ brand: { $in: ids }, isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "serie": {
      const ids = toObjectIds(value);
      if (!ids.length) return [];
      const docs = await Product.find({ serie: { $in: ids }, isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "sport": {
      const ids = toObjectIds(value);
      if (!ids.length) return [];
      const docs = await Product.find({ sport: { $in: ids }, isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "featured": {
      const docs = await Product.find({
        label: { $in: ["hot", "new", "limited"] },
        isActive: true,
      })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "bestseller": {
      const count = parseInt(value, 10) || 50;
      const docs = await Product.find({ isActive: true })
        .sort({ score: -1 })
        .limit(count)
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "new": {
      const days = parseInt(value, 10) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const docs = await Product.find({
        isActive: true,
        createdAt: { $gte: since },
      })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "discount": {
      // Legacy: products manually labelled "discount". Kept for backward
      // compatibility with events created before the DiscountRule integration.
      const docs = await Product.find({ label: "discount", isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    case "discountRule":
      return resolveDiscountRuleProducts(value);

    case "tag": {
      const tags = toArray(value);
      if (!tags.length) return [];
      const docs = await Product.find({ tag: { $in: tags }, isActive: true })
        .select("_id")
        .lean();
      return docs.map((d) => d._id.toString());
    }

    default:
      return [];
  }
}

export async function resolveEventProducts(productSelection = {}) {
  await connectToDB();

  const {
    rules = [],
    limit = 24,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = productSelection;

  // Resolve every rule in parallel — they are independent queries, so awaiting
  // them sequentially would be a needless waterfall.
  const resolved = await Promise.all(
    rules.map(async (rule) => ({
      operator: rule.operator,
      ids: await resolveRule(rule),
    }))
  );

  const includedIds = new Set();
  const excludedIds = new Set();
  let hasIncludeRule = false;

  for (const { operator, ids } of resolved) {
    if (operator === "exclude") {
      ids.forEach((id) => excludedIds.add(id));
    } else {
      hasIncludeRule = true;
      ids.forEach((id) => includedIds.add(id));
    }
  }

  const query = { isActive: true };

  if (hasIncludeRule) {
    const allowed = Array.from(includedIds).filter((id) => !excludedIds.has(id));
    // An include-only selection that resolved to nothing must stay empty,
    // otherwise we'd fall through to "all products".
    query._id = { $in: allowed };
  } else if (excludedIds.size > 0) {
    query._id = { $nin: Array.from(excludedIds) };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 200);
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [products, rate] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .limit(safeLimit)
      .populate("brand", "name title logo icon")
      .lean(),
    getCachedRate(),
  ]);

  // Attach canonical prices (EUR → Toman + active discounts) so event cards use
  // the same price contract as the rest of the storefront.
  const priced = await attachListingPrices(products, rate);
  return JSON.parse(JSON.stringify(priced));
}
