import ProductSlider from "@/components/features/bestSellers/BestSellers";
import { getRelatedProducts } from "base/services/relatedProducts.service";

export default async function RelatedProducts({ productId, rate }) {
  let selection;
  try {
    selection = await getRelatedProducts(productId, rate);
  } catch (error) {
    // An optional recommendation failure must not break the product/purchase page.
    console.error("Related products failed:", error);
    return null;
  }

  if (!selection.products.length) return null;

  return (
    <ProductSlider
      title="محصولات مرتبط"
      highlight="مرتبط"
      subtitle={selection.mode === "technical"
        ? "نزدیک‌ترین انتخاب‌ها به مشخصات فنی این محصول"
        : "انتخاب‌های مشابه بر اساس برچسب‌های این محصول"}
      products={selection.products}
      rate={rate}
    />
  );
}
