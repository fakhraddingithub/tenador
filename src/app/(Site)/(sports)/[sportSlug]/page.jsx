import { getPageDataBySlug } from "base/services/product.service";
import { getSeriesBySport, getSeriesFilterIndex } from "base/services/series.service";
import { resolvePageContext } from "base/services/query.service";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import BrandGroupedView from "@/components/templates/sports/BrandGroupedView";
import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker";
import { notFound } from "next/navigation";
import { getCachedRate } from "@/lib/Exchangerate";
import { getSportTickerBrands } from "base/services/brandTicker.service";
import { getPublicArticleCategory } from "base/services/publicArticle.service";
import { decodeSlugParam } from "base/utils/articleSlug";
import ArticleCategoryPage from "@/components/features/articles/ArticleCategoryPage";
import { articleCategoryMetadata } from "@/lib/articleSeo";
import { buildTaxonomyMetadata } from "@/lib/seo/taxonomySeo";
import TaxonomyStructuredData from "@/components/seo/TaxonomyStructuredData";
import TaxonomyBreadcrumbs from "@/components/seo/TaxonomyBreadcrumbs";
import { getBrandGroupedSections } from "base/services/brandGrouped.service";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import { normalizeTargetAudience } from "base/utils/targetAudience";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");
const INITIAL_BRAND_SECTIONS = 2;

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;

  // RULE 2: یک سگمنتیِ ریشه فقط می‌تواند SPORT یا BRAND باشد؛ هر چیزِ دیگر ۴۰۴
  const ctx = await resolvePageContext([sportSlug], { includeBrandStats: false });
  if (ctx.notFound) {
    const articleCategory = await getPublicArticleCategory(decodeSlugParam(sportSlug));
    return articleCategory ? articleCategoryMetadata(articleCategory.category) : { title: "صفحه پیدا نشد" };
  }
  const { title, description } = buildTaxonomyMetadata(ctx.filters);
  const pageUrl = `${SITE_URL}/${sportSlug}`;
  let activeEntity = ctx.filters.brand || ctx.filters.sport;

  // A root brand is already fully resolved above. Avoid loading the generic
  // product listing only to build its social metadata.
  if (!ctx.filters.brand) {
    const data = await getPageDataBySlug(sportSlug);
    if (!data) return { title: "صفحه پیدا نشد" };
    activeEntity = data.info;
  }

  const rawImage = activeEntity?.headImage || activeEntity?.image;
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

export default async function DynamicSportPage({ params, searchParams }) {
  const { sportSlug } = await params;

  // RULE 2: ریشه فقط SPORT یا BRAND — validatorِ سخت‌گیر تصمیم می‌گیرد، نه صرفِ
  // وجودِ اسلاگ در رجیستری (که اسلاگِ دسته/سری را هم می‌پذیرفت → soft-404).
  const ctx = await resolvePageContext([sportSlug], { includeBrandStats: false });
  if (ctx.notFound) {
    const articleCategory = await getPublicArticleCategory(decodeSlugParam(sportSlug));
    if (!articleCategory) notFound();
    return <ArticleCategoryPage category={articleCategory.category} articles={articleCategory.articles} />;
  }

  // Root brand pages use the grouped, progressively-loaded storefront. This
  // removes the generic 20-product cap and exposes related limited editions as
  // collaboration sections without changing Product.
  if (ctx.filters.brand && !ctx.filters.sport) {
    const sp = (await searchParams) || {};
    const targetAudience = normalizeTargetAudience(sp.targetAudience);
    const brandId = ctx.filters.brand._id;
    const articleBlocks = Array.isArray(ctx.filters.brand.articleBlocks)
      ? ctx.filters.brand.articleBlocks
      : [];

    const [initialData, rate, articleEntities] = await Promise.all([
      getBrandGroupedSections({
        brandId,
        offset: 0,
        limit: INITIAL_BRAND_SECTIONS,
        withIndex: true,
        targetAudience,
      }),
      getCachedRate(),
      articleBlocks.length > 0
        ? resolveArticleEntities({ blocks: articleBlocks })
        : Promise.resolve(null),
    ]);

    // Article blocks are rendered on the server below the hero. Do not send
    // the same editor payload through the client component a second time.
    const pageInfo = { ...ctx.filters.brand };
    delete pageInfo.articleBlocks;
    delete pageInfo.series;
    const filters = { ...ctx.filters, brand: pageInfo };
    let miniArticleSection = null;

    if (articleBlocks.length > 0) {
      const { default: BrandMiniArticleSection } = await import(
        "@/components/features/brands/BrandMiniArticleSection"
      );
      miniArticleSection = (
        <BrandMiniArticleSection
          blocks={articleBlocks}
          entities={articleEntities}
          brandName={pageInfo.title || pageInfo.name}
        />
      );
    }

    return (
      <>
        <TaxonomyStructuredData
          filters={filters}
          products={initialData}
          canonical={`${SITE_URL}/${sportSlug}`}
        />
        <BrandGroupedView
          key={JSON.stringify([String(brandId), String(targetAudience || "")])}
          pageInfo={pageInfo}
          filters={filters}
          rate={rate}
          brandId={brandId}
          initialData={initialData}
          targetAudience={targetAudience}
          title={`تنادور – ${pageInfo.title || pageInfo.name || ""}`}
          belowHero={
            <>
              <TaxonomyBreadcrumbs filters={filters} />
              {miniArticleSection}
            </>
          }
        />
      </>
    );
  }

  const [data, series, seriesIndex, rate] = await Promise.all([
    getPageDataBySlug(sportSlug),
    getSeriesBySport(sportSlug),
    getSeriesFilterIndex(),
    getCachedRate(),
  ]);
  if (!data) notFound();

  const serializedSportInfo = JSON.parse(JSON.stringify(data.info));
  const serializedProducts = JSON.parse(JSON.stringify(data.products));
  const serializedSeries = JSON.parse(JSON.stringify(series));
  const title = `تنادور – فروشگاه تخصصی تجهیزات و لوازم ${serializedSportInfo.title}`;
  let miniArticleSection = null;

  // The article renderer is a comparatively rich module. Load it only for a
  // brand that actually has content so ordinary sport pages keep their
  // existing server/client module footprint.
  if (data.type === "brand" && data.miniArticle) {
    const { default: BrandMiniArticleSection } = await import(
      "@/components/features/brands/BrandMiniArticleSection"
    );
    miniArticleSection = (
      <BrandMiniArticleSection
        blocks={data.miniArticle.blocks}
        entities={data.miniArticle.entities}
        brandName={serializedSportInfo.title || serializedSportInfo.name}
      />
    );
  }

  // نوار برندهای همین ورزش — کلیک روی هر برند به /[sportSlug]/[brandSlug] می‌رود
  const tickerBrands = await getSportTickerBrands(serializedSportInfo._id);

  return (
    <>
      <TaxonomyStructuredData
        filters={ctx.filters}
        products={serializedProducts}
        canonical={`${SITE_URL}/${sportSlug}`}
      />
      <SportPageClient
        pageInfo={serializedSportInfo}
        products={serializedProducts}
        totalResults={data.totalResults}
        listingFilter={{ sport: serializedSportInfo._id }}
        title={title}
        rate={rate}
        series={serializedSeries}
        seriesIndex={seriesIndex}
        belowHero={miniArticleSection}
      />
      {/* نوار برندهای همین ورزش — در پایینِ صفحه */}
      {tickerBrands.length > 0 && (
        <BrandsTicker brands={tickerBrands} sportSlug={sportSlug} />
      )}
    </>
  );
}
