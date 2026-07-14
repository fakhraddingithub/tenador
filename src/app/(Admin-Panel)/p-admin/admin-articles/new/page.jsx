export const dynamic = "force-dynamic";

import ArticleEditor from "@/components/admin/articles/ArticleEditor";

export const metadata = { title: "مقاله جدید | پنل تنادور" };

export default function NewArticlePage() {
  return <ArticleEditor />;
}
