import Image from "next/image";
import Link from "next/link";
import { FiClock } from "react-icons/fi";
import { buildArticlePath } from "base/utils/articleSlug";

export function formatArticleDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export default function ArticleCard({ article, priority = false }) {
  const category = article.category;
  const href = buildArticlePath(category?.slug, article.slug) || "/articles";
  return (
    <article className="group h-full overflow-hidden rounded-[var(--radius)] border border-black/10 bg-white transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none">
      <Link href={href} className="block rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
          {article.cover?.url ? <Image src={article.cover.url} alt={article.cover.alt || article.title} fill priority={priority} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transition-none" /> : null}
          {category?.name ? <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--color-primary)] backdrop-blur">{category.name}</span> : null}
        </div>
        <div className="p-5">
          <h2 className="line-clamp-2 text-lg font-black leading-8 text-gray-900 transition-colors group-hover:text-[var(--color-primary)]">{article.title}</h2>
          {article.excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-7 text-gray-500">{article.excerpt}</p> : null}
          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
            <time dateTime={article.publishedAt || article.updatedAt}>{formatArticleDate(article.publishedAt || article.updatedAt)}</time>
            {article.readingTime ? <span className="flex items-center gap-1"><FiClock aria-hidden="true" /> {article.readingTime.toLocaleString("fa-IR")} دقیقه</span> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

