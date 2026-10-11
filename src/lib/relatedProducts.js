import { findClosestProducts } from "../components/templates/productMatch/matchEngine.js";

export const RELATED_PRODUCTS_LIMIT = 8;

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
