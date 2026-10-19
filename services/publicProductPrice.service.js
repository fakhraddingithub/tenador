import "base/models/registerModels";
import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import { computeProductPrice } from "base/services/priceEngine";

const cachedPrice = unstable_cache(async (snapshot, rate) => {
  await connectToDB();
  return computeProductPrice(JSON.parse(snapshot), rate);
}, ["public-product-seo-price-v1"], { revalidate: 60, tags: ["products", "exchange-rate"] });

export function getPublicProductPrice(product, rate) {
  const id = (value) => String(value?._id || value || "");
  return cachedPrice(JSON.stringify({ _id: id(product), basePrice: product.basePrice,
    brand: id(product.brand), category: id(product.category), serie: id(product.serie) }), rate);
}
