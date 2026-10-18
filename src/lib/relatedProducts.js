import { findClosestProducts } from "../components/templates/productMatch/matchEngine.js";

export const RELATED_PRODUCTS_LIMIT = 3;
export const COMPLEMENTARY_PRODUCTS_LIMIT = 5;

const idOf = (value) => String(value?._id ?? value ?? "");

/** Nearest series first; visited ids also protect against malformed cycles. */
export function complementarySerieTiers(serieId, series) {
  const currentId = idOf(serieId);
  if (!currentId) return [];
  const byId = new Map(series.map((serie) => [idOf(serie), serie]));
  const children = new Map();
  for (const serie of series) {
    const parent = idOf(serie.parentSerie);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(idOf(serie));
  }
  const visited = new Set([currentId]);
  const tiers = [[currentId]];
  const descendants = (root) => {
    let level = [root];
    while (level.length) {
      const next = [];
      for (const parent of level) {
        for (const child of children.get(parent) || []) {
          if (visited.has(child)) continue;
          visited.add(child);
          next.push(child);
        }
      }
      if (next.length) tiers.push(next);
      level = next;
    }
  };
  descendants(currentId);
  let parent = idOf(byId.get(currentId)?.parentSerie);
  while (parent && byId.has(parent) && !visited.has(parent)) {
    visited.add(parent);
    tiers.push([parent]);
    descendants(parent); // sibling branches, after the parent's own products
    parent = idOf(byId.get(parent)?.parentSerie);
  }
  return tiers;
}

export function selectComplementaryProducts(source, candidates, series, similarProducts = []) {
  const brandId = idOf(source.serie?.brand || source.brand);
  const sportId = idOf(source.sport);
  const categoryId = idOf(source.category);
  if (!brandId || !sportId || !categoryId) return [];
  const seen = new Set([idOf(source), ...similarProducts.map(idOf)]);
  const categoryCounts = new Map();
  const selected = [];
  const eligible = candidates.filter((product) =>
    idOf(product.brand) === brandId && idOf(product.sport) === sportId &&
    idOf(product.category) && idOf(product.category) !== categoryId &&
    product.isActive !== false,
  );
  const tiers = complementarySerieTiers(source.serie, series);
  const groups = tiers.map((tier) => {
    const ids = new Set(tier);
    return eligible.filter((product) => ids.has(idOf(product.serie)));
  });
  groups.push(eligible); // same brand + sport, only after exhausting the family

  for (const group of groups) {
    // Prefer variety within each priority tier before taking a second item.
    for (const cap of [1, 2]) {
      for (const product of group) {
        const id = idOf(product);
        const category = idOf(product.category);
        const count = categoryCounts.get(category) || 0;
        if (!id || seen.has(id) || count >= cap) continue;
        seen.add(id);
        categoryCounts.set(category, count + 1);
        selected.push(product);
        if (selected.length === COMPLEMENTARY_PRODUCTS_LIMIT) return selected;
      }
    }
  }
  return selected;
}

export function hasMatchableStats(product) {
  return (product.category?.technicalStats || []).some(
    (stat) => Number.isFinite(stat.min) && Number.isFinite(stat.max) &&
      stat.max > stat.min && Number.isFinite(product.technicalStats?.[stat.name]),
  );
}

export function normalizedProductTags(tags) {
  return new Set((Array.isArray(tags) ? tags : [])
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.normalize("NFKC").toLowerCase()
      .replace(/ي/g, "ی").replace(/ك/g, "ک")
      .replace(/[\s\u200c]+/g, " ").trim())
    .filter(Boolean));
}

/** Candidates are active products, in stable _id order, from the service. */
export function rankRelatedProducts(source, candidates) {
  if (hasMatchableStats(source)) {
    return {
      mode: "technical",
      products: findClosestProducts({
        targetStats: source.technicalStats,
        candidateProducts: candidates,
        categoryStats: source.category.technicalStats,
        excludeId: source._id,
        topN: RELATED_PRODUCTS_LIMIT,
      }).map(({ product }) => product),
    };
  }

  const targetTags = normalizedProductTags(source.tag);
  if (!targetTags.size) return { mode: "tags", products: [] };

  // Jaccard similarity: extra unrelated tags must not inflate a match.
  // Duplicate tags count once; zero-overlap products are never filler.
  const ranked = candidates
    .filter((product) => String(product._id) !== String(source._id))
    .map((product) => {
      const tags = normalizedProductTags(product.tag);
      const common = [...targetTags].filter((tag) => tags.has(tag)).length;
      return { product, common, similarity: common / (targetTags.size + tags.size - common) };
    })
    .filter(({ common }) => common > 0)
    .sort((a, b) => b.similarity - a.similarity || b.common - a.common);

  return { mode: "tags", products: ranked.slice(0, RELATED_PRODUCTS_LIMIT).map(({ product }) => product) };
}
