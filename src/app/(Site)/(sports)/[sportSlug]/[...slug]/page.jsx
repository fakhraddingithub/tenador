import { notFound } from "next/navigation";
import SportPageClient from "@/components/templates/sports/SportPageClient";
import BrandGroupedView from "@/components/templates/sports/BrandGroupedView";
import { getCachedRate } from "@/lib/Exchangerate";
import { queryBySlugs, resolvePageContext } from "base/services/query.service";
import { getBrandGroupedSections } from "base/services/brandGrouped.service";

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

  // ─── سایر صفحات (ورزش، دسته، سری، همکاری): همان رفتار قبلی ───
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
