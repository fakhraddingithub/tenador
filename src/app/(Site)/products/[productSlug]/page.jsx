import ProductTemplate from "@/components/templates/product/ProductTemplate";
import { getProductBySlug } from "base/services/product.service";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

export default async function ProductPage({ params }) {
  const { productSlug } = await params;

  if (!productSlug) {
    throw new Error("اسلاگ محصول معتبر نیست");
  }

  const fetchProduct = await getProductBySlug(productSlug);
  if (!product) {
    throw new Error("محصول مورد نظر یافت نشد");
  }

  const rate = await getCachedRate();
  const priceInToman = eurToToman(fetchProduct.basePrice, rate);

  const product = { ...fetchProduct, basePrice: priceInToman };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ProductTemplate product={product} />
    </div>
  );
}
