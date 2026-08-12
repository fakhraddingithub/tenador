import Image from "next/image";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import { buildArticlePath } from "base/utils/articleSlug";

// موزاییکِ ادیتوریال: یک گریدِ ساده با جای‌گذاریِ صریح در هر بریک‌پوینت.
// دسکتاپ ‎۴×۳ (قطعه‌ی شاخص ۲×۲)، تبلت ‎۳×۴، موبایل دو ستونی.
// چون سایت RTL است، ستونِ ۱ سمتِ راست است: مقاله‌ی اولِ لیست همان قطعه‌ی
// شاخصِ ‎۲×۲ بالا-راست می‌شود — جایی که چشمِ خواننده‌ی فارسی اول می‌افتد.
const LAYOUT = [
  "col-span-2 aspect-[16/10] md:col-start-1 md:row-start-1 md:col-span-2 md:row-span-2 md:aspect-auto lg:col-start-1 lg:row-start-1 lg:col-span-2 lg:row-span-2",
  "aspect-[4/5] md:col-start-3 md:row-start-1 md:aspect-auto lg:col-start-3 lg:row-start-1",
  "aspect-[4/5] md:col-start-3 md:row-start-2 md:aspect-auto lg:col-start-3 lg:row-start-2",
  "aspect-[4/5] md:col-start-1 md:row-start-3 md:aspect-auto lg:col-start-4 lg:row-start-1 lg:row-span-2",
  "aspect-[4/5] md:col-start-2 md:row-start-3 md:aspect-auto lg:col-start-1 lg:row-start-3",
  "aspect-[4/5] md:col-start-3 md:row-start-3 md:aspect-auto lg:col-start-2 lg:row-start-3",
  "aspect-[4/5] md:col-start-1 md:row-start-4 md:col-span-2 md:aspect-auto lg:col-start-3 lg:row-start-3 lg:col-span-1",
  "col-span-2 aspect-[16/10] md:col-start-3 md:row-start-4 md:col-span-1 md:aspect-auto lg:col-start-4 lg:row-start-3",
];

const SIZES = [
  "(max-width:767px) 100vw, (max-width:1023px) 58vw, 40vw",
  "(max-width:767px) 50vw, (max-width:1023px) 29vw, 20vw",
  "(max-width:767px) 50vw, (max-width:1023px) 29vw, 20vw",
  "(max-width:767px) 50vw, (max-width:1023px) 29vw, 20vw",
  "(max-width:767px) 50vw, (max-width:1023px) 29vw, 20vw",
  "(max-width:767px) 50vw, (max-width:1023px) 29vw, 20vw",
  "(max-width:767px) 50vw, (max-width:1023px) 58vw, 20vw",
  "(max-width:767px) 100vw, (max-width:1023px) 29vw, 20vw",
];

export default function FeaturedArticles({ articles = [] }) {
  if (articles.length !== LAYOUT.length) return null;

  return (
    <section className="relative bg-white py-12 md:py-24" aria-labelledby="featured-articles-title">
      <div className="container relative mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        <div className="mb-10 md:mb-16">
          <HomeSectionHeading
            id="featured-articles-title"
            title="مقالات منتخب تنادور"
            highlight="مقالات"
            subtitle="راهنماها، داستان‌ها و تازه‌ترین نگاه‌های دنیای ورزش"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:auto-rows-[220px] lg:grid-cols-4 lg:auto-rows-[240px]">
          {articles.map((article, index) => (
            <Link
              key={article._id}
              href={buildArticlePath(article.category?.slug, article.slug) || "/articles"}
              aria-label={`مطالعه مقاله: ${article.title}`}
              className={`group relative block overflow-hidden rounded-[6px] bg-gray-900 shadow-sm outline-none transition-shadow duration-300 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${LAYOUT[index]}`}
            >
              <Image
                src={article.cover.url}
                alt={article.cover.alt || article.title}
                fill
                sizes={SIZES[index]}
                className="object-cover object-center transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5 transition-opacity duration-300 group-hover:opacity-90"
              />
              <span className="absolute inset-x-0 bottom-0 p-4 transition-transform duration-300 motion-safe:group-hover:-translate-y-1 md:p-5">
                {article.category?.name ? (
                  <span className="mb-2 inline-flex rounded-[6px] border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    {article.category.name}
                  </span>
                ) : null}
                {/* بدونِ کلاسِ block — display:block کلمپِ دوخطی را می‌شکند */}
                <span className="line-clamp-2 text-base font-black leading-7 text-white drop-shadow-md md:text-lg xl:text-xl xl:leading-8">
                  {article.title}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
