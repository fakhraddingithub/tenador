import { notFound } from "next/navigation";
import { getCompareCategories } from "base/services/compareCategory.service";
import { getRacketPriceBounds } from "base/services/racketMatch.service";
import MatchCategoryClient from "@/components/templates/productMatch/MatchCategoryClient";
import MatchToolClient from "@/components/templates/productMatch/MatchToolClient";
import ToolSeoContent from "@/components/seo/ToolSeoContent";
import { findMatchCategory, hasGuidedQuiz, matchCategoryPath } from "@/lib/matchTools";

export const revalidate = 3600;

async function resolveMatchCategory(sportSlug, categorySlug) {
  const categories = await getCompareCategories();
  return findMatchCategory(
    categories,
    decodeURIComponent(sportSlug),
    decodeURIComponent(categorySlug),
  );
}

export async function generateMetadata({ params }) {
  const { sportSlug, categorySlug } = await params;
  const category = await resolveMatchCategory(sportSlug, categorySlug);
  if (!category) return { title: "دسته‌بندی یافت نشد" };

  // نامِ ورزش در عنوان می‌آید تا «راکت تنیس» و «راکت پدل» در نتایج جستجو یکی
  // دیده نشوند — همان قاعده‌ای که در عنوانِ صفحه‌های دسته‌بندی هم رعایت شده است.
  const fullTitle = [category.title, category.sportTitle].filter(Boolean).join(" ");

  return {
    title: `انتخاب و مچ کردن ${fullTitle}`,
    description: `با مقایسه شاخص‌های فنی، مناسب‌ترین ${fullTitle} را بر اساس محصول فعلی و سبک بازی خود پیدا کنید.`,
    alternates: { canonical: matchCategoryPath(category) },
  };
}

export default async function MatchCategoryPage({ params }) {
  const { sportSlug, categorySlug } = await params;
  const category = await resolveMatchCategory(sportSlug, categorySlug);

  if (!category) notFound();

  // دامنهٔ اسلایدرِ بودجه سمتِ سرور و از کاتالوگِ کش‌شده می‌آید تا پرسشنامه بدون
  // درخواستِ اضافه و بدون پرشِ مقدارِ اولیه رندر شود.
  const priceBounds = hasGuidedQuiz(category) ? await getRacketPriceBounds() : null;

  const canonicalPath = matchCategoryPath(category);
  const fullTitle = [category.title, category.sportTitle].filter(Boolean).join(" ");

  return (
    <>
      {hasGuidedQuiz(category) ? (
        // دسته‌ای که هم پرسشنامهٔ «راکت ایده‌آل» دارد و هم مسیرِ «ارتقای راکت فعلی»
        // ابتدا انتخابِ مسیر را به کاربر می‌دهد.
        <MatchToolClient category={category} priceBounds={priceBounds} />
      ) : (
        <MatchCategoryClient category={category} />
      )}
      <ToolSeoContent type="match" categoryTitle={fullTitle} canonicalPath={canonicalPath} />
    </>
  );
}
