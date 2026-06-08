import { notFound } from "next/navigation";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { getCachedRate } from "@/lib/Exchangerate";
import { queryBySlugs } from "base/services/query.service";

// اسلاگ‌های فارسی این مسیر قبلاً باعث خطای ۵۰۰ می‌شدند (باگ Next: کاراکترِ
// غیر-ASCII در هدر x-next-cache-tags → ERR_INVALID_CHAR). با پچِ
// patches/next+16.2.6.patch مسیر با encodeURI امن شد، پس ISR دوباره فعال است.
export const revalidate = 300;

// مسیرها on-demand ساخته می‌شوند؛ در زمان build هیچ‌کدام pre-render نمی‌شوند
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { sportSlug, slug } = await params;
  const slugs = [sportSlug, ...(slug || [])];

  const data = await queryBySlugs(slugs);

  if (!data?.filters?.sport) {
    return { title: "صفحه پیدا نشد" };
  }

  const activeEntity =
    data.filters.serie ||
    data.filters.brand ||
    data.filters.category ||
    data.filters.sport;

  return {
    title: `خرید تجهیزات ${activeEntity.title || activeEntity.name}`,
    description:
      activeEntity.description ||
      `بهترین قیمت تجهیزات ${activeEntity.title || activeEntity.name}`,
  };
}

export default async function SportDynamicSlugPage({ params }) {
  const { sportSlug, slug } = await params;
  const slugs = [sportSlug, ...(slug || [])];

  const [searchData, rate] = await Promise.all([
    queryBySlugs(slugs),
    getCachedRate(),
  ]);

  if (!searchData?.filters?.sport) {
    notFound();
  }

  const pageInfo =
    searchData.filters.serie ||
    searchData.filters.brand ||
    searchData.filters.category ||
    searchData.filters.sport;

  return (
    <SportPageClient
      pageInfo={pageInfo}
      filters={searchData.filters}
      products={searchData.results}
      totalResults={searchData.totalResults}
      rate={rate}
      title={`تنادور – ${pageInfo.title || pageInfo.name || ""}`}
    />
  );
}
