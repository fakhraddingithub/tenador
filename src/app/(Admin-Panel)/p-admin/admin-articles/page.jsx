export const dynamic = "force-dynamic";

import ArticleList from "@/components/admin/articles/ArticleList";

export const metadata = { title: "مدیریت مقالات | پنل تنادور" };

export default function AdminArticlesPage() {
  return <ArticleList />;
}
