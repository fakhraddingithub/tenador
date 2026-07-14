export const dynamic = "force-dynamic";

import ArticleEditor from "@/components/admin/articles/ArticleEditor";

export const metadata = { title: "ویرایش مقاله | پنل تنادور" };

export default async function EditArticlePage({ params }) {
  const { articleId } = await params;
  return <ArticleEditor articleId={articleId} />;
}
