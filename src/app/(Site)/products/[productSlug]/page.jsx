import ProductTemplate from "@/components/templates/product/ProductTemplate";
import { getProductBySlug } from "base/services/product.service";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";
import { generateProductMetadata } from "@/lib/seo/productSeo";
import { generateProductSchema } from "@/lib/seo/productSchema";
import { generateBreadcrumbSchema } from "@/lib/seo/breadcrumbSchema";
import Product from "base/models/Product";
import connectToDB from "base/configs/db";

// --------------------
// Dynamic Metadata
// --------------------
export async function generateMetadata({ params }) {
  await connectToDB();

  const resolvedParams = await params;

  const product = await Product.findOne({
    slug: resolvedParams.productSlug,
  })
    .populate("brand")
    .populate("category")
    .lean();

  if (!product) {
    return {
      title: "محصول پیدا نشد",
    };
  }

  return generateProductMetadata(product);
}

export default async function ProductPage({ params }) {
  const { productSlug } = await params;

  if (!productSlug) {
    throw new Error("اسلاگ محصول معتبر نیست");
  }

  const fetchProduct = await getProductBySlug(productSlug);
  if (!fetchProduct) {
    throw new Error("محصول مورد نظر یافت نشد");
  }

  // دریافت نرخ تبدیل
  const rate = await getCachedRate();

  // تبدیل قیمت پایه محصول
  const priceInToman = eurToToman(fetchProduct.basePrice, rate);

  // تبدیل قیمت تمام واریانت‌ها
  const convertedVariants =
    fetchProduct.variants?.map((variant) => ({
      ...variant,
      price: eurToToman(variant.price, rate),
    })) || [];

  // محصول نهایی با قیمت‌های تبدیل شده
  const product = {
    ...fetchProduct,
    basePrice: priceInToman,
    variants: convertedVariants,
  };

  const productSchema = generateProductSchema(product);
  const breadcrumbSchema = generateBreadcrumbSchema(product);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

<div className="hidden md:block relative h-[200px] w-full overflow-hidden">
  <img
    src={product.category.image || "/images/default-category.jpg"}
    alt={product.category.name}
    className="w-full h-full object-cover scale-105"
  />
  
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
  
  <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
    <h1 className="text-1xl md:text-4xl font-bold text-white mb-4 drop-shadow-xl">
      {product.category.title}
    </h1>

    <div className="w-20 h-1 bg-[var(--color-primary)] rounded-full mb-4" />
  </div>
</div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProductTemplate product={product} />
      </div>
    </>
  );
}
