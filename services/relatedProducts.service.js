import "base/models/registerModels";
import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Serie from "base/models/Serie";
import { attachListingPrices } from "base/services/priceEngine";
import { hasMatchableStats, normalizedProductTags, rankRelatedProducts, selectComplementaryProducts } from "@/lib/relatedProducts";

const getRelatedSelection = unstable_cache(
  async (productId) => {
    await connectToDB();
    const source = await Product.findOne({ _id: productId, isActive: true })
      .select("category technicalStats tag serie brand sport")
      .populate("category", "technicalStats")
      .populate("serie", "brand parentSerie")
      .lean();

    if (!source) return { mode: "tags", products: [] };
    const technical = hasMatchableStats(source);
    const canMatch = technical || normalizedProductTags(source.tag).size > 0;
    const brand = source.serie?.brand || source.brand;
    const canComplement = Boolean(brand && source.sport && source.category?._id);

    // Rank the entire eligible pool, not an arbitrary first batch. Only the
    // matching fields are read; images, variants and prices load for the 3 + 5.
    const [candidates, complements, series] = await Promise.all([
      canMatch ? Product.find({
        isActive: true,
        _id: { $ne: source._id },
        slug: { $type: "string", $ne: "" },
        ...(technical
          ? { category: source.category._id }
          : { "tag.0": { $exists: true } }),
      })
        .select(technical ? "technicalStats" : "tag")
        .sort({ _id: 1 })
        .lean() : [],
      canComplement ? Product.find({
        isActive: true,
        _id: { $ne: source._id },
        slug: { $type: "string", $ne: "" },
        brand,
        sport: source.sport,
        category: { $ne: source.category._id },
      }).select("serie category brand sport").sort({ order: 1, _id: 1 }).lean() : [],
      canComplement && source.serie ? Serie.find({ brand })
        .select("parentSerie").sort({ order: 1, _id: 1 }).lean() : [],
    ]);

    const selection = rankRelatedProducts(source, candidates);
    const complementary = selectComplementaryProducts(source, complements, series, selection.products);
    const ids = [...selection.products, ...complementary].map((product) => product._id);
    if (!ids.length) return { mode: selection.mode, products: [] };

    // Same populated card/quick-view payload as the home sliders. Keep EUR
    // base/variant prices intact; attachListingPrices adds the Toman fields.
    const products = await Product.find({ _id: { $in: ids }, isActive: true })
      .populate("brand")
      .populate("category")
      .populate("variants")
      .lean();
    const byId = new Map(products.map((product) => [String(product._id), product]));

    return JSON.parse(JSON.stringify({
      mode: selection.mode,
      products: ids.map((id) => byId.get(String(id))).filter(Boolean),
    }));
  },
  ["related-products-3-similar-5-complementary-v2"],
  { revalidate: 300, tags: ["products", "categories", "brands", "series", "sports"] },
);

export async function getRelatedProducts(productId, rate) {
  const selection = await getRelatedSelection(String(productId));
  if (!selection.products.length) return selection;
  // Pricing is outside the selection cache so rate/discount updates apply.
  const products = await attachListingPrices(selection.products, rate);
  return { ...selection, products: JSON.parse(JSON.stringify(products)) };
}
