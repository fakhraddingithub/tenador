import { getPageDataBySlug } from "base/services/product.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";

import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";

export async function generateMetadata({ params }) {
  const { categorySlug } = await params;

  const data = await getPageDataBySlug(categorySlug);

  if (!data) {
    return {
      title: "صفحه پیدا نشد",
    };
  }

  return {
    title: `خرید ${data.info.title || data.info.name} | فروشگاه تنادور`,
    description:
      data.info.description ||
      `بهترین قیمت محصولات دسته‌بندی ${data.info.title}`,
  };
}

export default async function CategoryPage({ params }) {
  const { categorySlug } = await params;

  const [data, rate] = await Promise.all([
    getPageDataBySlug(categorySlug),
    getCachedRate(),
  ]);

  if (!data) notFound();
  const pageInfo = JSON.parse(JSON.stringify(data.info));
  const title = pageInfo.title;
  return (
    <SportPageClient
      pageInfo={JSON.parse(JSON.stringify(data.info))}
      products={JSON.parse(JSON.stringify(data.products))}
      title={title}
      rate={rate}
    />
  );
}
