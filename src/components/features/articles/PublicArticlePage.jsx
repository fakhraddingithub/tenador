import Image from "next/image";
import Link from "next/link";
import { FiChevronLeft, FiClock, FiHome, FiRefreshCw, FiUser } from "react-icons/fi";
import ArticleBlockRenderer, { articleHeadings } from "@/components/features/articles/ArticleBlockRenderer";
import ArticleReadingTools from "@/components/features/articles/ArticleReadingTools";
import ArticleCard, { formatArticleDate } from "@/components/features/articles/ArticleCard";
import { absoluteArticleUrl, articleSchemas } from "@/lib/articleSeo";
import { buildArticlePath } from "base/utils/articleSlug";

export default function PublicArticlePage({ article, relatedArticles = [], entities }) {
  const headings = articleHeadings(article.blocks);
  const url = absoluteArticleUrl(buildArticlePath(article.category.slug, article.slug));
  const authorName = [article.author?.name, article.author?.lastName].filter(Boolean).join(" ") || "تحریریه تنادور";
  const explicitProducts = Object.values(entities?.maps?.products || {});
  const schemas = articleSchemas(article, explicitProducts.slice(0, 10));
  const published = formatArticleDate(article.publishedAt);
  const updated = formatArticleDate(article.updatedAt);
  const showUpdated = article.updatedAt && article.publishedAt && new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 86400000;

  return (
    <article className="bg-[var(--color-background)] pb-20"><a href="#article-content" className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-white focus:p-3">{"\u067e\u0631\u0634 \u0628\u0647 \u0645\u062d\u062a\u0648\u0627\u06cc \u0645\u0642\u0627\u0644\u0647"}</a>
      {schemas.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />)}
      <header className="border-b border-black/5 bg-white">
        <div className="container mx-auto px-4 py-8 md:px-12 md:py-12 lg:px-16 xl:px-20">
          <nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-gray-500" aria-label="مسیر صفحه"><Link href="/" aria-label="خانه"><FiHome /></Link><FiChevronLeft aria-hidden="true" /><Link href={`/${article.category.slug}`} className="hover:text-[var(--color-primary)]">{article.category.name}</Link><FiChevronLeft aria-hidden="true" /><span className="max-w-48 truncate">{article.title}</span></nav>
          <div className="mx-auto max-w-5xl text-center">
            <Link href={`/${article.category.slug}`} className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] px-4 py-2 text-xs font-bold text-[var(--color-primary)]">{article.category.name}</Link>
            <h1 className="mt-5 text-3xl font-black leading-[1.55] text-gray-900 md:text-5xl">{article.title}</h1>
            {article.excerpt ? <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-gray-600 md:text-lg">{article.excerpt}</p> : null}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-gray-500">
              <span className="flex items-center gap-2"><FiUser aria-hidden="true" />{authorName}</span>
              {published ? <time dateTime={article.publishedAt}>{published}</time> : null}
              {showUpdated ? <span className="flex items-center gap-2"><FiRefreshCw aria-hidden="true" />به‌روزرسانی {updated}</span> : null}
              {article.readingTime ? <span className="flex items-center gap-2"><FiClock aria-hidden="true" />{article.readingTime.toLocaleString("fa-IR")} دقیقه مطالعه</span> : null}
            </div>
          </div>
          {article.cover?.url ? <figure className="mx-auto mt-10 max-w-6xl"><div className="relative aspect-[16/8] overflow-hidden rounded-[var(--radius)] bg-gray-100 shadow-sm"><Image src={article.cover.url} alt={article.cover.alt || article.title} fill priority fetchPriority="high" sizes="(max-width: 1280px) 100vw, 1152px" className="object-cover" /></div>{article.cover.caption ? <figcaption className="mt-3 text-center text-xs text-gray-500">{article.cover.caption}</figcaption> : null}</figure> : null}
        </div>
      </header>

      <div className="container mx-auto grid max-w-7xl gap-10 px-4 pt-10 md:px-12 lg:grid-cols-[240px_minmax(0,820px)] lg:justify-center lg:px-16 xl:px-20">
        <div className="order-2 lg:order-1"><ArticleReadingTools headings={headings} title={article.title} url={url} /></div>
        <div id="article-content" tabIndex={-1} data-article-body className="order-1 min-w-0 rounded-[var(--radius)] bg-white px-5 py-3 md:px-10 lg:order-2">
          <ArticleBlockRenderer blocks={article.blocks} entities={entities} />
          <section className="my-12 rounded-[var(--radius)] border border-dashed border-gray-300 bg-gray-50 p-6 text-center"><h2 className="font-black text-gray-800">دیدگاه‌ها</h2><p className="mt-2 text-sm leading-7 text-gray-500">امکان ثبت و نمایش دیدگاه‌ها به‌زودی به مجله تنادور اضافه می‌شود.</p></section>
        </div>
      </div>

      {relatedArticles.length ? <section className="container mx-auto mt-16 px-4 md:px-12 lg:px-16 xl:px-20"><div className="mb-6 flex items-end justify-between"><div><span className="text-sm font-bold text-[var(--color-primary)]">پیشنهاد برای مطالعه</span><h2 className="mt-2 text-2xl font-black text-gray-900">مقالات مرتبط</h2></div><Link href={`/${article.category.slug}`} className="text-sm font-bold text-[var(--color-primary)]">مشاهده همه</Link></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{relatedArticles.map((item) => <ArticleCard key={item._id} article={item} />)}</div></section> : null}
    </article>
  );
}

