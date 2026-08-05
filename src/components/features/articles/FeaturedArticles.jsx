import Image from "next/image";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";

const PIECES = [
  "md:col-span-2 md:row-span-2 lg:col-span-3 lg:row-span-2",
  "md:col-span-2 md:row-span-1 lg:col-span-2 lg:row-span-1",
  "md:col-span-2 md:row-span-1 lg:col-span-1 lg:row-span-2",
  "md:col-span-1 md:row-span-1 lg:col-span-2 lg:row-span-1",
  "md:col-span-1 md:row-span-1 lg:col-span-2 lg:row-span-2",
  "md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-1",
  "md:col-span-1 md:row-span-1 lg:col-span-1 lg:row-span-1",
  "md:col-span-1 md:row-span-1 lg:col-span-1 lg:row-span-1",
];

const MOBILE_PIECES = [
  "col-span-2 min-h-72",
  "col-span-1 min-h-52",
  "col-span-1 min-h-52",
  "col-span-2 min-h-56",
  "col-span-1 min-h-52",
  "col-span-1 min-h-52",
  "col-span-2 min-h-56",
  "col-span-2 min-h-64",
];

export default function FeaturedArticles({ articles = [] }) {
  if (articles.length !== 8) return null;

  return (
    <section className="relative overflow-hidden bg-white py-12 md:py-24" aria-labelledby="featured-articles-title">
      <div className="container relative z-10 mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        <div className="mb-10 md:mb-16">
          <HomeSectionHeading
            id="featured-articles-title"
            title="مقالات منتخب تنادور"
            highlight="مقالات"
            subtitle="راهنماها، داستان‌ها و تازه‌ترین نگاه‌های دنیای ورزش"
          />
        </div>

        <div className="grid grid-cols-2 auto-rows-auto gap-4 md:grid-cols-4 md:auto-rows-[190px] lg:grid-cols-6 lg:auto-rows-[180px] xl:auto-rows-[210px]">
          {articles.map((article, index) => {
            const href = `/${article.category.slug}/${article.slug}`;
            return (
              <Link
                key={article._id}
                href={href}
                aria-label={`مطالعه مقاله: ${article.title}`}
                className={`group relative isolate block overflow-hidden rounded-[6px] bg-gray-900 shadow-sm outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/15 focus-visible:ring-4 focus-visible:ring-[var(--color-primary)]/35 focus-visible:ring-offset-2 ${MOBILE_PIECES[index]} ${PIECES[index]}`}
              >
                <Image
                  src={article.cover.url}
                  alt={article.cover.alt || article.title}
                  fill
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 34vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5 transition-opacity duration-300 group-hover:opacity-90" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 transition-transform duration-300 motion-safe:group-hover:-translate-y-1 md:p-5">
                  {article.category?.name ? (
                    <span className="mb-2 inline-flex rounded-[6px] border border-white/20 bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {article.category.name}
                    </span>
                  ) : null}
                  <h3 className="line-clamp-2 text-base font-black leading-7 text-white drop-shadow-sm md:text-lg lg:text-xl">
                    {article.title}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
