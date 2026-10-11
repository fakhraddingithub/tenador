import "base/models/registerModels";
import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import { attachListingPrices } from "base/services/priceEngine";
import { hasMatchableStats, normalizedProductTags, rankRelatedProducts } from "@/lib/relatedProducts";

const getRelatedSelection = unstable_cache(
  async (productId) => {
    await connectToDB();
    const source = await Product.findOne({ _id: productId, isActive: true })
      .select("category technicalStats tag")
      .populate("category", "technicalStats")
      .lean();

    if (!source) return { mode: "tags", products: [] };
    const technical = hasMatchableStats(source);
    if (!technical && !normalizedProductTags(source.tag).size) {
      return { mode: "tags", products: [] };
    }

    // Rank the entire eligible pool, not an arbitrary first batch. Only the
    // matching fields are read; images, variants and prices load for the top 8.
    const candidates = await Product.find({
      isActive: true,
      _id: { $ne: source._id },
      slug: { $type: "string", $ne: "" },
      ...(technical
        ? { category: source.category._id }
        : { "tag.0": { $exists: true } }),
    })
      .select(technical ? "technicalStats" : "tag")
      .sort({ _id: 1 })
      .lean();

    const selection = rankRelatedProducts(source, candidates);
    const ids = selection.products.map((product) => product._id);
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
  ["related-products-v1"],
  { revalidate: 300, tags: ["products", "categories", "brands"] },
);

export async function getRelatedProducts(productId, rate) {
  const selection = await getRelatedSelection(String(productId));
  if (!selection.products.length) return selection;
  // Pricing is outside the selection cache so rate/discount updates apply.
  const products = await attachListingPrices(selection.products, rate);
  return { ...selection, products: JSON.parse(JSON.stringify(products)) };
}
