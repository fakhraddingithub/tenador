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

  const rate = await getCachedRate();
  const priceInToman = eurToToman(fetchProduct.basePrice, rate);

  const product = { ...fetchProduct, basePrice: priceInToman };

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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProductTemplate product={product} />
      </div>
    </>
  );
}
