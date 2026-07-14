export const dynamic = "force-dynamic";

import ArticlePreview from "@/components/admin/articles/ArticlePreview";

export const metadata = { title: "پیش‌نمایش مقاله | پنل تنادور" };

export default async function PreviewArticlePage({ params }) {
  const { articleId } = await params;
  return <ArticlePreview articleId={articleId} />;
}
