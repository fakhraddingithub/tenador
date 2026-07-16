import { getPageDataBySlug } from "base/services/product.service";
import { getSeriesBySport } from "base/services/series.service";
import { resolvePageContext } from "base/services/query.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker";
import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";
import { getSportTickerBrands } from "base/services/brandTicker.service";
import { getPublicArticleCategory } from "base/services/publicArticle.service";
import { decodeSlugParam } from "base/utils/articleSlug";
import ArticleCategoryPage from "@/components/features/articles/ArticleCategoryPage";
import { articleCategoryMetadata } from "@/lib/articleSeo";

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;

  // RULE 2: یک سگمنتیِ ریشه فقط می‌تواند SPORT یا BRAND باشد؛ هر چیزِ دیگر ۴۰۴
  const ctx = await resolvePageContext([sportSlug]);
  if (ctx.notFound) {
    const articleCategory = await getPublicArticleCategory(decodeSlugParam(sportSlug));
    return articleCategory ? articleCategoryMetadata(articleCategory.category) : { title: "صفحه پیدا نشد" };
  }
  const data = await getPageDataBySlug(sportSlug);
  if (!data) return { title: "صفحه پیدا نشد" };

  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");
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
    alternates: { canonical: pageUrl },
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

  // RULE 2: ریشه فقط SPORT یا BRAND — validatorِ سخت‌گیر تصمیم می‌گیرد، نه صرفِ
  // وجودِ اسلاگ در رجیستری (که اسلاگِ دسته/سری را هم می‌پذیرفت → soft-404).
  const ctx = await resolvePageContext([sportSlug]);
  if (ctx.notFound) {
    const articleCategory = await getPublicArticleCategory(decodeSlugParam(sportSlug));
    if (!articleCategory) notFound();
    return <ArticleCategoryPage category={articleCategory.category} articles={articleCategory.articles} />;
  }

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

  // نوار برندهای همین ورزش — کلیک روی هر برند به /[sportSlug]/[brandSlug] می‌رود
  const tickerBrands = await getSportTickerBrands(serializedSportInfo._id);

  return (
    <>
      <SportPageClient
        pageInfo={serializedSportInfo}
        products={serializedProducts}
        totalResults={data.totalResults}
        listingFilter={{ sport: serializedSportInfo._id }}
        title={title}
        rate={rate}
        series={serializedSeries}
      />
      {/* نوار برندهای همین ورزش — در پایینِ صفحه */}
      {tickerBrands.length > 0 && (
        <BrandsTicker brands={tickerBrands} sportSlug={sportSlug} />
      )}
    </>
  );
}
