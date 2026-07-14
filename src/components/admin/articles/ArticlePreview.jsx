import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowRight, FiEdit3 } from "react-icons/fi";
import requireAdmin from "@/lib/requireAdmin";
import { getArticleForAdmin } from "base/services/article.service";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import ArticleBlockRenderer from "@/components/features/articles/ArticleBlockRenderer";

export default async function ArticlePreview({ articleId }) {
  const admin = await requireAdmin();
  if (!admin) notFound();
  const article = await getArticleForAdmin(articleId);
  if (!article) notFound();
  const entities = await resolveArticleEntities(article);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="a-card sticky top-[132px] z-20 mb-4 flex items-center gap-3 p-3">
        <Link href="/p-admin/admin-articles" aria-label="بازگشت به فهرست مقالات" className="rounded-[var(--admin-radius)] p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><FiArrowRight aria-hidden="true" /></Link>
        <div><strong className="block text-sm">پیش‌نمایش مقاله</strong><small className="text-gray-400">این صفحه برای مشتریان منتشر نشده است.</small></div>
        <Link href={`/p-admin/admin-articles/${articleId}`} className="mr-auto inline-flex items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><FiEdit3 aria-hidden="true" /> ویرایش</Link>
      </div>
      <article className="a-card p-6 sm:p-12">
        <header className="mb-10">
          <span className="text-xs font-bold text-[var(--color-primary)]">{article.category?.name}</span>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{article.title}</h1>
          {article.excerpt ? <p className="mt-4 leading-8 text-gray-500">{article.excerpt}</p> : null}
          {article.cover?.url ? <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[var(--admin-radius)] bg-gray-100"><Image src={article.cover.url} alt={article.cover.alt || article.title} fill priority sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" /></div> : null}
        </header>
        <div data-article-body><ArticleBlockRenderer blocks={article.blocks || []} entities={entities} preview /></div>
      </article>
    </div>
  );
}
