import { notFound } from "next/navigation";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { getCachedRate } from "@/lib/Exchangerate";
import { queryBySlugs } from "base/services/query.service";

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sportSlug, slug } = await params;
  const slugs = [sportSlug, ...(slug || [])];

  const data = await queryBySlugs(slugs);

  if (!data?.filters?.sport) {
    return { title: "صفحه پیدا نشد" };
  }

  const activeEntity =
    data.filters.serie ||
    data.filters.collaboration ||
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
    searchData.filters.collaboration ||
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
