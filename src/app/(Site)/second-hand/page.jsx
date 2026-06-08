import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Product from "base/models/Product";
import HealthCard from "base/models/HealthCard";
import SiteSetting from "base/models/SiteSetting";
import UsedProductsPageClient from "@/components/templates/secondHands/UsedProductsPageClient";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

export const revalidate = 300;

export const metadata = {
  title: "بازار دست‌دوم | فروش تجهیزات ورزشی کارکرده",
  description: "خرید و فروش تجهیزات ورزشی دست‌دوم با کارت سلامت معتبر",
};

export default async function UsedProductsPage() {
  await connectToDB();

  const rawProducts = await UsedProduct.find({ status: "available" })
    .populate({
      path: "baseProduct",
      select: "name mainImage shortDescription basePrice brand category sku",
      populate: [
        { path: "brand", select: "title slug logo icon" },
        { path: "category", select: "title slug" },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const rate = await getCachedRate();
  const headerSetting = await SiteSetting.findOne({
    key: "secondhand_header_image",
  }).lean();
  const headerImage = headerSetting?.value || null;
  const allHealthCards = await HealthCard.find().lean();
  // تبدیل آرایه کارت‌ها به یک آبجکت واحد برای دسترسی سریع
  // خروجی چیزی شبیه این می‌شود: { engine: "وضعیت موتور", body: "سلامت بدنه", ... }
  const cardFieldMap = {};
  allHealthCards.forEach((card) => {
    card.fields.forEach((field) => {
      cardFieldMap[field.key] = field.label;
    });
  });
  // حذف محصولاتی که baseProduct آنها null است
  const products = rawProducts
    .filter((p) => p.baseProduct)
    .map((p) => {
      const currentHealthScores = p.healthScores || [];
      return {
        _id: p._id.toString(),
        slug: p.slug || null,
        tested: !!p.tested,
        overallScore: p.overallScore,
        healthScores: currentHealthScores.map((s) => ({
          key: s.key,
          // اگر در نقشه کارت سلامت بود، لیبل فارسی را بگذار، وگرنه خودِ کلید را
          label: cardFieldMap[s.key] || s.key,
          rating: s.rating,
          note: s.note || "",
        })),
        price: eurToToman(p.price, rate),
        name: p.name,
        description: p.description.trim()
          ? p.description
          : p.baseProduct.shortDescription,
        images: p.images || [],
        status: p.status,
        createdAt: p.createdAt?.toISOString(),
        baseProduct: {
          _id: p.baseProduct._id.toString(),
          name: p.baseProduct.name,
          mainImage: p.baseProduct.mainImage,
          basePrice: p.baseProduct.basePrice,
          sku: p.baseProduct.sku,
          brand: p.baseProduct.brand
            ? {
                _id: p.baseProduct.brand._id.toString(),
                title: p.baseProduct.brand.title,
                slug: p.baseProduct.brand.slug,
                logo: p.baseProduct.brand.logo,
                icon: p.baseProduct.brand.icon,
              }
            : null,
          category: p.baseProduct.category
            ? {
                _id: p.baseProduct.category._id.toString(),
                title: p.baseProduct.category.title,
                slug: p.baseProduct.category.slug,
              }
            : null,
        },
      };
    });
  return <UsedProductsPageClient products={products} headerImage={headerImage} />;
}
