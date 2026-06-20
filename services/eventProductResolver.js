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
import Variant from "base/models/Variant";
import DiscountRule from "base/models/DiscountRule";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";
import { productMatchesAttrFilters } from "@/lib/attributeFilters";
import { isColorAttribute } from "@/lib/colorMatch";

// ─── Color matching (HSL-based) ───────────────────────────────────────────────
// We match products by PERCEPTUAL color, not raw hex distance: a hex range would
// wrongly group colors that look unrelated. Converting to HSL lets us match by
// HUE (the "which color" axis), so all shades of pink group together regardless
// of their exact hex, while a minimum SATURATION threshold keeps near-grey /
// near-white colors from accidentally matching a vivid target hue.

/** Normalizes "#abc" / "abc" / "#aabbcc" / "AABBCC" to lowercase "#aabbcc", else null. */
function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return "#" + h.toLowerCase();
}

/** hex → { h: 0–360, s: 0–100, l: 0–100 }, or null for non-hex values. */
function hexToHsl(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = (((g - b) / d) % 6 + 6) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** Shortest distance between two hues on the 360° wheel (red wraps 0↔360). */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Reads a key from a Mongoose Map (lean may return a Map or a plain object). */
function readAttr(attrs, key) {
  if (!attrs) return undefined;
  if (attrs instanceof Map) return attrs.get(key);
  return attrs[key];
}

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

/**
 * Returns product ids whose color (or ANY of their variant colors) falls within
 * the (now hardcoded) hue tolerance of the target hue.
 *
 * value shape: { hex: "#ff69b4", excludedIds: [<productId>, ...] }
 *
 * The admin only picks a target color: hue tolerance is fixed at its maximum
 * (HUE_TOLERANCE_MAX°) and minimum saturation at 0 (so no shade is filtered out
 * by saturation). The admin can then remove individual products in the review
 * step; those ids live in `excludedIds` and are dropped from the result here.
 *
 * Products with no valid-hex color anywhere are skipped gracefully. Variant
 * color attributes are only considered when they are valid hex strings (named
 * colors like "قرمز" can't be matched perceptually, so they're ignored).
 */
const HUE_TOLERANCE_MAX = 30;

async function resolveColorRule(value) {
  const cfg = value && typeof value === "object" ? value : {};
  const target = hexToHsl(cfg.hex);
  if (!target) return [];

  const tolerance = HUE_TOLERANCE_MAX; // hardcoded max — UI no longer exposes this
  const minSat = 0; // hardcoded — saturation no longer filters matches

  const matchesHex = (hex) => {
    const hsl = hexToHsl(hex);
    if (!hsl) return false;
    if (hsl.s < minSat) return false;
    return hueDistance(hsl.h, target.h) <= tolerance;
  };

  const products = await Product.find({ isActive: true })
    .select("_id color")
    .lean();

  const matched = new Set();
  const unmatched = [];
  for (const p of products) {
    if (matchesHex(p.color)) matched.add(p._id.toString());
    else unmatched.push(p._id);
  }

  // For products the base color didn't match, accept them if ANY variant color
  // (when stored as a valid hex) falls in range.
  if (unmatched.length) {
    const variants = await Variant.find({ productId: { $in: unmatched } })
      .select("productId attributes")
      .lean();
    for (const v of variants) {
      const pid = v.productId?.toString();
      if (!pid || matched.has(pid)) continue;
      const colorVal =
        readAttr(v.attributes, "color") ??
        readAttr(v.attributes, "Color") ??
        readAttr(v.attributes, "رنگ");
      if (matchesHex(colorVal)) matched.add(pid);
    }
  }

  // Drop products the admin manually removed during the review-and-confirm step.
  const excluded = new Set(
    (Array.isArray(cfg.excludedIds) ? cfg.excludedIds : []).map((id) => String(id))
  );
  return Array.from(matched).filter((id) => !excluded.has(id));
}

/**
 * Returns product ids matching a button-based attribute selection (the same
 * shared filter UI used across the storefront). `value.filters` has the shape
 * { [attrName]: [value, ...] }; the color attribute uses the 16-swatch names and
 * is matched perceptually (hue) + textually via the shared colorMatch logic.
 *
 * We reuse productMatchesAttrFilters so a campaign filters products identically
 * to how the storefront does. Variants are populated so variant colors count.
 */
async function resolveAttributeRule(value) {
  const filters = value && typeof value === "object" ? value.filters || {} : {};
  const names = Object.keys(filters).filter(
    (n) => Array.isArray(filters[n]) && filters[n].length
  );
  if (!names.length) return [];

  const attrMeta = names.map((name) => ({
    name,
    type: isColorAttribute(name) ? "color" : "text",
  }));

  const products = await Product.find({ isActive: true })
    .select("_id attributes color variants")
    .populate("variants", "attributes variantAttributes color")
    .lean();

  return products
    .filter((p) => productMatchesAttrFilters(p, filters, attrMeta))
    .map((p) => p._id.toString());
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

    case "color":
      return resolveColorRule(value);

    case "attribute":
      return resolveAttributeRule(value);

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
      // sport/category را هم populate می‌کنیم تا فیلترهای «ورزش تخصصی» و «نوع محصول»
      // در سایدبارِ صفحهٔ کمپین نامِ فارسی نشان دهند نه _id خام. (فیلتر همچنان با
      // id کار می‌کند؛ فقط برچسبِ نمایشی title/name می‌شود.)
      .populate("sport", "name title slug order")
      .populate("category", "name title slug order")
      .lean(),
    getCachedRate(),
  ]);

  // Attach canonical prices (EUR → Toman + active discounts) so event cards use
  // the same price contract as the rest of the storefront.
  const priced = await attachListingPrices(products, rate);
  return JSON.parse(JSON.stringify(priced));
}
