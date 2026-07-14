import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import ArticleCard from "@/components/features/articles/ArticleCard";
import { getPublicArticleHub } from "base/services/publicArticle.service";

export const metadata = {
  title: "مجله تنادور",
  description: "راهنماها، بررسی‌ها و تازه‌ترین مطالب تخصصی تنادور",
  alternates: { canonical: "/articles" },
};

export default async function ArticlesPage() {
  const { categories, articles } = await getPublicArticleHub();
  return (
    <div className="bg-[var(--color-background)] pb-20">
      <header className="border-b border-black/5 bg-white">
        <div className="container mx-auto px-4 py-14 md:px-12 md:py-20 lg:px-16 xl:px-20">
          <span className="text-sm font-bold text-[var(--color-primary)]">مجله تنادور</span>
          <h1 className="mt-3 text-3xl font-black text-gray-900 md:text-5xl">راهنمای انتخاب و تجربه بهتر ورزش</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-gray-600">مقاله‌های تخصصی، بررسی تجهیزات و تازه‌ترین خبرهای دنیای ورزش‌های راکتی.</p>
          {categories.length ? <nav className="mt-8 flex flex-wrap gap-2" aria-label="دسته‌بندی مقالات">{categories.map((category) => <Link key={category._id} href={`/${category.slug}`} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">{category.name}</Link>)}</nav> : null}
        </div>
      </header>
      <main className="container mx-auto px-4 pt-10 md:px-12 lg:px-16 xl:px-20">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-black text-gray-900">تازه‌ترین مقالات</h2>{categories[0] ? <Link href={`/${categories[0].slug}`} className="flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">مشاهده دسته‌ها <FiArrowLeft /></Link> : null}</div>
        {articles.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{articles.map((article, index) => <ArticleCard key={article._id} article={article} priority={index < 2} />)}</div> : <div className="rounded-[var(--radius)] border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">هنوز مقاله‌ای منتشر نشده است.</div>}
      </main>
    </div>
  );
}