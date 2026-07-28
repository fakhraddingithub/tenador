import { notFound } from "next/navigation";
import { getCompareCategories } from "base/services/compareCategory.service";
import MatchCategoryClient from "@/components/templates/productMatch/MatchCategoryClient";
import ToolSeoContent from "@/components/seo/ToolSeoContent";

export const revalidate = 3600;

async function resolveMatchCategory(categorySlug) {
  const decodedSlug = decodeURIComponent(categorySlug);
  const categories = await getCompareCategories();
  return categories.find(
    (item) =>
      item.slug === decodedSlug &&
      (item.technicalStats?.length || 0) >= 2,
  );
}

export async function generateMetadata({ params }) {
  const { categorySlug } = await params;
  const category = await resolveMatchCategory(categorySlug);
  if (!category) return { title: "دسته‌بندی یافت نشد" };

  return {
    title: `انتخاب و مچ کردن ${category.title}`,
    description: `با مقایسه شاخص‌های فنی، مناسب‌ترین ${category.title} را بر اساس محصول فعلی و سبک بازی خود پیدا کنید.`,
    alternates: { canonical: `/match/${category.slug}` },
  };
}

export default async function MatchCategoryPage({ params }) {
  const { categorySlug } = await params;
  const category = await resolveMatchCategory(categorySlug);

  if (!category) notFound();

  return (
    <>
      <MatchCategoryClient category={category} />
      <ToolSeoContent
        type="match"
        categoryTitle={category.title}
        canonicalPath={`/match/${category.slug}`}
      />
    </>
  );
}
