import { notFound } from "next/navigation";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { getCachedRate } from "@/lib/Exchangerate";

export async function generateMetadata({ params }) {
  const { sportSlug, slug } = await params;

  // ترکیب sportSlug با بقیه اسلاگ‌ها
  const slugs = [sportSlug, ...(slug || [])];

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slugs }),
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!data?.filters?.sport) {
    return {
      title: "صفحه پیدا نشد",
    };
  }

  return {
    title: `خرید تجهیزات ${data.filters.sport.title || data.filters.sport.name}`,
    description:
      data.filters.sport.description ||
      `بهترین قیمت تجهیزات ${data.filters.sport.title}`,
  };
}

export default async function SportDynamicSlugPage({ params }) {
  const { sportSlug, slug } = await params;

  // همه اسلاگ‌ها
  const slugs = [sportSlug, ...(slug || [])];

  const [searchData, rate] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slugs,
      }),
      cache: "no-store",
    }).then((res) => res.json()),

    getCachedRate(),
  ]);

  if (!searchData?.filters?.sport) {
    notFound();
  }

  return (
    <SportPageClient
      pageInfo={JSON.parse(
        JSON.stringify(searchData.filters.sport)
      )}
      filters={JSON.parse(
        JSON.stringify(searchData.filters)
      )}
      products={JSON.parse(
        JSON.stringify(searchData.results)
      )}
      totalResults={searchData.totalResults}
      rate={rate}
      title={`تنادور – فروشگاه تخصصی تجهیزات ${searchData.filters.sport.title}`}
    />
  );
}