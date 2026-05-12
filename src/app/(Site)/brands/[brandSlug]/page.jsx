import { getPageDataBySlug } from "base/services/product.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";

import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";

export async function generateMetadata({ params }) {
  const { brandSlug } = await params;

  const data = await getPageDataBySlug(brandSlug);

  if (!data) {
    return {
      title: "صفحه پیدا نشد",
    };
  }

  return {
    title: `خرید تجهیزات ${data.info.title || data.info.name} | فروشگاه تنادور`,
    description:
      data.info.description ||
      `بهترین قیمت تجهیزات تخصصی ${data.info.title}`,
  };
}

export default async function BrandPage({ params }) {
  const { brandSlug } = await params;

  const [data, rate] = await Promise.all([
    getPageDataBySlug(brandSlug),
    getCachedRate(),
  ]);

  if (!data) notFound();

  return (
    <SportPageClient
      pageInfo={JSON.parse(JSON.stringify(data.info))}
      products={JSON.parse(JSON.stringify(data.products))}
      rate={rate}
    />
  );
}

