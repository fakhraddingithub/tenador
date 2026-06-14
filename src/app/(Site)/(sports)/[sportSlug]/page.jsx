import { getPageDataBySlug } from "base/services/product.service";
import { getSeriesBySport } from "base/services/series.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const data = await getPageDataBySlug(sportSlug);
  if (!data) return { title: "صفحه پیدا نشد" };

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";
  const title = `خرید تجهیزات و لوازم ${data.info.title || data.info.name}`;
  const description =
    data.info.description || `بهترین قیمت تجهیزات تخصصی ${data.info.title}`;
  const pageUrl = `${SITE_URL}/${sportSlug}`;
  const rawImage = data.info.image;
  const imageUrl = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${SITE_URL}${rawImage}`
    : null;

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
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
