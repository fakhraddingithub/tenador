import ProductTemplate from "@/components/templates/product/ProductTemplate";
import { getProductBySlug } from "base/services/product.service";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";
import { generateProductMetadata } from "@/lib/seo/productSeo";
import { generateProductSchema } from "@/lib/seo/productSchema";
import { generateBreadcrumbSchema } from "@/lib/seo/breadcrumbSchema";

// اسلاگ‌های فارسی این مسیر قبلاً باعث خطای ۵۰۰ می‌شدند (باگ Next: کاراکترِ
// غیر-ASCII در هدر x-next-cache-tags → ERR_INVALID_CHAR). با پچِ
// patches/next+16.2.6.patch مسیر با encodeURI امن شد، پس ISR دوباره فعال است.
export const revalidate = 300;

// مسیرها on-demand ساخته می‌شوند؛ در زمان build هیچ‌کدام pre-render نمی‌شوند
export async function generateStaticParams() {
  return [];
}

// --------------------
// Dynamic Metadata
// --------------------
export async function generateMetadata({ params }) {
  const { productSlug } = await params;

  // از همان سرویس کش‌شده استفاده می‌شود تا کوئری دوباره به دیتابیس نخورد
  const product = await getProductBySlug(productSlug);

  if (!product || product.error) {
    return { title: "محصول پیدا نشد" };
  }

  return generateProductMetadata(product);
}

export default async function ProductPage({ params }) {
  const { productSlug } = await params;

  if (!productSlug) {
    throw new Error("اسلاگ محصول معتبر نیست");
  }

  const fetchProduct = await getProductBySlug(productSlug);
  if (!fetchProduct || fetchProduct.error) {
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
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProductTemplate product={product} />
      </div>
    </>
  );
}
