import { getPageDataBySlug } from "base/services/product.service"; // مسیری که تابع را در آن ذخیره کردید
import SportPageClient from "@/components/templates/sports/SportPageClient"; // مسیری که کامپوننت کلاینت را ذخیره کردید
import { notFound } from "next/navigation";

// تنظیم عنوان صفحه به صورت داینامیک برای سئو
export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const data = await getPageDataBySlug(sportSlug);

  if (!data) return { title: "صفحه پیدا نشد" };

  return {
    title: `خرید تجهیزات ${data.info.title || data.info.name} | فروشگاه تنادور`,
    description: data.info.description || `بهترین قیمت تجهیزات تخصصی ${data.info.title}`,
  };
}

export default async function DynamicSportPage({ params }) {
  // ۱. استخراج اسلاگ از پارامترهای URL
  const { sportSlug } =await params;

  // ۲. دریافت اطلاعات جامع (اطلاعات ورزش + محصولات مرتبط) از سرویس
  const data = await getPageDataBySlug(sportSlug);

  // ۳. اگر اسلاگ در دیتابیس (SlugRegistry) نبود، کاربر را به ۴۰۴ بفرست
  if (!data) {
    notFound();
  }

  // ۴. چک کردن اینکه آیا این اسلاگ واقعاً مربوط به یک "ورزش" است یا خیر
  // (چون ممکن است برند یا دسته‌بندی هم با همین ساختار URL باشند)
  if (data.type !== "sport") {
    // اینجا می‌توانید تصمیم بگیرید که کامپوننت دیگری را رندر کنید 
    // یا فعلاً فقط برای ورزش‌ها ادامه دهید
  }

  // ۵. سریالایز کردن داده‌ها برای ارسال به کامپوننت کلاینت (برای جلوگیری از خطای ObjectId)
  const serializedSportInfo = JSON.parse(JSON.stringify(data.info));
  const serializedProducts = JSON.parse(JSON.stringify(data.products));

  return (
    <SportPageClient 
      sportInfo={serializedSportInfo} 
      products={serializedProducts} 
    />
  );
}