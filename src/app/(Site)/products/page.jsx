import ProductListClient from "@/components/templates/products/ProductListClient";
import { getProducts } from "base/services/product.service";
import { getCachedRate } from "@/lib/Exchangerate";

export default async function ProductsPage() {
  
  const products = await getProducts();
  const rate = await getCachedRate()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6 text-[#1a1a1a]">
        لیست محصولات
      </h1>

      <ProductListClient products={products} rate={rate}/>
    </div>
  );
}