export const dynamic = "force-dynamic";

import ArticleTaxonomies from "@/components/admin/articles/ArticleTaxonomies";

export const metadata = { title: "دسته‌ها و برچسب‌های مقاله | پنل تنادور" };

export default function ArticleSettingsPage() {
  return <ArticleTaxonomies />;
}
