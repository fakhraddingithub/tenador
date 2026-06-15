import { notFound } from "next/navigation";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import BrandGroupedView from "@/components/templates/sports/BrandGroupedView";
import SerieGroupedView from "@/components/templates/sports/SerieGroupedView";
import { getCachedRate } from "@/lib/Exchangerate";
import { queryBySlugs, resolvePageContext } from "base/services/query.service";
import { getBrandGroupedSections } from "base/services/brandGrouped.service";
import { getSerieGroupedSections } from "base/services/serieGrouped.service";

// تعداد بخش‌های سری در بارگذاری اولیه‌ی سرور (SSR) — سبک برای SEO و سرعت
const INITIAL_SECTIONS = 2;

// آیا این صفحه، صفحه‌ی برند است (عمیق‌ترین موجودیت برند است، نه سری/همکاری/محصول)؟
function isBrandPage(filters) {
  return (
    !!filters?.brand &&
    !filters?.serie &&
    !filters?.collaboration &&
    !filters?.product
  );
}

// آیا این صفحه، یک سری ریشه (level 0) است که باید به صورت گروه‌بندی‌شده نمایش داده شود؟
function isParentSeriePage(filters) {
  return (
    !!filters?.serie &&
    filters.serie.level === 0 &&
    !filters?.product
  );
}

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { sportSlug, slug } = await params;
  const slugs = [sportSlug, ...(slug || [])];

  const filters = await resolvePageContext(slugs);

  if (!filters?.sport) {
    return { title: "صفحه پیدا نشد" };
  }

  const activeEntity =
    filters.serie ||
    filters.collaboration ||
    filters.brand ||
    filters.category ||
    filters.sport;

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";
  const title = `خرید تجهیزات ${activeEntity.title || activeEntity.name}`;
  const description =
    activeEntity.description ||
    `بهترین قیمت تجهیزات ${activeEntity.title || activeEntity.name}`;
  const pageUrl = `${SITE_URL}/${slugs.join("/")}`;
  const rawImage = activeEntity.headImage || activeEntity.image;
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

export default async function SportDynamicSlugPage({ params }) {
  const { sportSlug, slug } = await params;
  const slugs = [sportSlug, ...(slug || [])];

  // ابتدا فقط موجودیت‌های صفحه را تشخیص می‌دهیم (سبک، بدون بارگذاری همه‌ی محصولات)
  const filters = await resolvePageContext(slugs);

  if (!filters?.sport) {
    notFound();
  }

  const rate = await getCachedRate();

  // ─── صفحه‌ی برند: نمای گروه‌بندی‌شده بر اساس سری ریشه + infinite scroll ───
  if (isBrandPage(filters)) {
    const brandId = filters.brand._id;
    const sportId = filters.sport?._id || null;
    const categoryId = filters.category?._id || null;

    const initialData = await getBrandGroupedSections({
      brandId,
      sportId,
      categoryId,
      offset: 0,
      limit: INITIAL_SECTIONS,
      withIndex: true,
    });

    const pageInfo = filters.brand;

    return (
      <BrandGroupedView
        pageInfo={pageInfo}
        filters={filters}
        rate={rate}
        brandId={brandId}
        sportId={sportId}
        categoryId={categoryId}
        initialData={initialData}
        title={`تنادور – ${pageInfo.title || pageInfo.name || ""}`}
      />
    );
  }

  // ─── صفحه‌ی سری ریشه (level 0): نمای گروه‌بندی‌شده بر اساس زیرسری‌های مستقیم ───
  if (isParentSeriePage(filters)) {
    const serieId = filters.serie._id;
    const sportId = filters.sport?._id || null;
    const categoryId = filters.category?._id || null;
    const brandSlug = filters.brand?.slug || "";

    const initialData = await getSerieGroupedSections({
      serieId,
      sportId,
      categoryId,
      offset: 0,
      limit: INITIAL_SECTIONS,
      withIndex: true,
    });

    const pageInfo = filters.serie;

    return (
      <SerieGroupedView
        pageInfo={pageInfo}
        filters={filters}
        rate={rate}
        serieId={serieId}
        sportId={sportId}
        categoryId={categoryId}
        brandSlug={brandSlug}
        initialData={initialData}
        title={`تنادور – ${pageInfo.title || pageInfo.name || ""}`}
      />
    );
  }

  // ─── سایر صفحات (ورزش، دسته، زیرسری، همکاری): همان رفتار قبلی ───
  const searchData = await queryBySlugs(slugs);

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
