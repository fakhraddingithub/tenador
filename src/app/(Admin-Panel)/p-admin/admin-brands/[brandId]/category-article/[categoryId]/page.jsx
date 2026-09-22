import BrandCategoryArticleEditor from "@/components/admin/brands/BrandCategoryArticleEditor";

export const metadata = { title: "مینی مقاله دسته برند | پنل تنادور" };

export default async function BrandCategoryArticlePage({ params }) {
  const { brandId, categoryId } = await params;
  return <BrandCategoryArticleEditor brandId={brandId} categoryId={categoryId} />;
}
