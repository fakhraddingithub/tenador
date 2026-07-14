import Image from "next/image";
import Link from "next/link";
import { FiChevronLeft, FiHome } from "react-icons/fi";
import ArticleCard from "@/components/features/articles/ArticleCard";

export default function ArticleCategoryPage({ category, articles }) {
  const featured = articles.find((article) => article.featured || article.pinned) || articles[0];
  const rest = articles.filter((article) => String(article._id) !== String(featured?._id));
  return (
    <div className="bg-[var(--color-background)] pb-20">
      <header className="relative overflow-hidden border-b border-black/5 bg-white">
        {category.cover?.url ? <div className="absolute inset-0 opacity-[0.08]"><Image src={category.cover.url} alt="" fill priority sizes="100vw" className="object-cover" /></div> : null}
        <div className="container relative mx-auto px-4 py-12 md:px-12 md:py-20 lg:px-16 xl:px-20">
          <nav className="mb-6 flex items-center gap-2 text-xs text-gray-500" aria-label="مسیر صفحه"><Link href="/" aria-label="خانه"><FiHome /></Link><FiChevronLeft aria-hidden="true" /><span>{category.name}</span></nav>
          <span className="mb-4 block text-sm font-bold text-[var(--color-primary)]">مجله تنادور</span>
          <h1 className="max-w-4xl text-3xl font-black leading-tight text-gray-900 md:text-5xl">{category.name}</h1>
          {category.description ? <p className="mt-5 max-w-3xl text-base leading-8 text-gray-600 md:text-lg">{category.description}</p> : null}
        </div>
      </header>

      <main className="container mx-auto px-4 pt-10 md:px-12 lg:px-16 xl:px-20">
        {featured ? (
          <ArticleCard article={{ ...featured, category: { name: category.name, slug: category.slug } }} priority />
        ) : <div className="rounded-[var(--radius)] border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">هنوز مقاله‌ای در این دسته منتشر نشده است.</div>}
        {rest.length ? <section className="mt-10"><h2 className="mb-6 text-2xl font-black text-gray-900">تازه‌ترین مقالات</h2><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rest.map((article) => <ArticleCard key={article._id} article={{ ...article, category: { name: category.name, slug: category.slug } }} />)}</div></section> : null}
      </main>
    </div>
  );
}

