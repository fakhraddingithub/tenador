import { getPageDataBySlug } from "base/services/product.service";
import { getSeriesBySport } from "base/services/series.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";

// اسلاگ‌های فارسی این مسیر قبلاً باعث خطای ۵۰۰ می‌شدند (باگ Next: کاراکترِ
// غیر-ASCII در هدر x-next-cache-tags → ERR_INVALID_CHAR). با پچِ
// patches/next+16.2.6.patch مسیر با encodeURI امن شد، پس ISR دوباره فعال است.
export const revalidate = 300;

// مسیرها on-demand ساخته می‌شوند؛ در زمان build هیچ‌کدام pre-render نمی‌شوند
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const data = await getPageDataBySlug(sportSlug);
  if (!data) return { title: "صفحه پیدا نشد" };
  return {
    title: `خرید تجهیزات و لوازم ${data.info.title || data.info.name} `,
    description:
      data.info.description || `بهترین قیمت تجهیزات تخصصی ${data.info.title}`,
  };
}

export default async function DynamicSportPage({ params }) {
  const { sportSlug } = await params;

  const [data, series, rate] = await Promise.all([
    getPageDataBySlug(sportSlug),
    getSeriesBySport(sportSlug),
    getCachedRate(),
  ]);

  if (!data) notFound();

  const serializedSportInfo = JSON.parse(JSON.stringify(data.info));
  const serializedProducts = JSON.parse(JSON.stringify(data.products));
  const serializedSeries = JSON.parse(JSON.stringify(series));
  const title = `تنادور – فروشگاه تخصصی تجهیزات و لوازم ${serializedSportInfo.title}`;
  
  return (
    <SportPageClient
      pageInfo={serializedSportInfo}
      products={serializedProducts}
      title={title}
      rate={rate}
      series={serializedSeries}
    />
  );
}
