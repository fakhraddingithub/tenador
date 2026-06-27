import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Product from "base/models/Product";
import HealthCard from "base/models/HealthCard";
import SiteSetting from "base/models/SiteSetting";
import UsedProductsPageClient from "@/components/templates/secondHands/UsedProductsPageClient";
import { getFilterableAttributes } from "base/services/product.service";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

// تغییراتِ ادمین از طریقِ revalidatePath("/second-hand") باطل می‌شوند؛
// TTL زمان‌محور → ۱ساعت برای کاهشِ ISR Writes.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";
const PAGE_TITLE = "بازار دست‌دوم | فروش تجهیزات ورزشی کارکرده";
const PAGE_DESC = "خرید و فروش تجهیزات ورزشی دست‌دوم با کارت سلامت معتبر";

export async function generateMetadata() {
  await connectToDB();
  const headerSetting = await SiteSetting.findOne({ key: "secondhand_header_image" }).lean();
  const rawImage = headerSetting?.value || null;
  const imageUrl = rawImage
    ? rawImage.startsWith("http") ? rawImage : `${SITE_URL}${rawImage}`
    : null;

  return {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESC,
      url: `${SITE_URL}/second-hand`,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: PAGE_TITLE }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: PAGE_TITLE,
      description: PAGE_DESC,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function UsedProductsPage() {
  await connectToDB();

  const rawProducts = await UsedProduct.find({ status: "available" })
    .populate({
      path: "baseProduct",
      // attributes + color برای فیلترِ ویژگی/رنگِ دکمه‌ای روی صفحهٔ دست‌دوم
      select: "name mainImage shortDescription basePrice brand category sku attributes color",
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
  // ترتیب فیلدهای هر کارت سلامت (بر اساس دسته‌بندی) تا نمایش امتیازها هم‌ترتیب باشد
  const cardOrderByCat = {};
  allHealthCards.forEach((card) => {
    const catId = card.category?.toString();
    card.fields.forEach((field, i) => {
      cardFieldMap[field.key] = field.label;
      if (catId) {
        (cardOrderByCat[catId] ||= {})[field.key] = i;
      }
    });
  });
  // حذف محصولاتی که baseProduct آنها null است
  const products = rawProducts
    .filter((p) => p.baseProduct)
    .map((p) => {
      const currentHealthScores = p.healthScores || [];
      // ترتیب نمایش امتیازها بر اساس ترتیب فیلدها در کارت سلامتِ همان دسته‌بندی
      const orderMap = cardOrderByCat[p.baseProduct.category?._id?.toString()] || {};
      const orderOf = (key) => (key in orderMap ? orderMap[key] : Infinity);
      return {
        _id: p._id.toString(),
        slug: p.slug || null,
        tested: !!p.tested,
        overallScore: p.overallScore,
        healthScores: currentHealthScores
          .map((s) => ({
            key: s.key,
            // اگر در نقشه کارت سلامت بود، لیبل فارسی را بگذار، وگرنه خودِ کلید را
            label: cardFieldMap[s.key] || s.key,
            rating: s.rating,
            note: s.note || "",
          }))
          .sort((a, b) => orderOf(a.key) - orderOf(b.key)),
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
          // برای فیلترِ ویژگی/رنگِ دکمه‌ای
          attributes: p.baseProduct.attributes || {},
          color: p.baseProduct.color || null,
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
  const filterableAttributes = await getFilterableAttributes();

  return (
    <UsedProductsPageClient
      products={products}
      headerImage={headerImage}
      filterableAttributes={filterableAttributes}
    />
  );
}
