import { getPageDataBySlug } from "base/services/product.service";
import { getSeriesBySport } from "base/services/series.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const data = await getPageDataBySlug(sportSlug);
  if (!data) return { title: "صفحه پیدا نشد" };
  return {
    title: `خرید تجهیزات ${data.info.title || data.info.name} | فروشگاه تنادور`,
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

  return (
    <SportPageClient
      sportInfo={serializedSportInfo}
      products={serializedProducts}
      rate={rate}
      series={serializedSeries}
    />
  );
}
