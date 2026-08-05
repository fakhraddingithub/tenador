import Image from "next/image";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import { buildArticlePath } from "base/utils/articleSlug";
import { CLIP_PATHS, PIECE_COUNT, PIECE_SIZES, PUZZLE_CSS } from "@/lib/articlePuzzle.mjs";

// چیدمانِ پازل کاملاً از روی هندسه‌ی src/lib/articlePuzzle.mjs ساخته می‌شود:
// هر کارت یک <a> با clip-path است، پس تب‌ها بخشی از سیلوئتِ واقعیِ همان کارت‌اند
// و تصویر (یک <Image> در هر کارت) بدونِ برش یا تکرار روی تب‌ها ادامه پیدا می‌کند.

export default function FeaturedArticles({ articles = [] }) {
  if (articles.length !== PIECE_COUNT) return null;

  return (
    <section
      className="relative bg-white py-12 md:py-24"
      aria-labelledby="featured-articles-title"
    >
      <style dangerouslySetInnerHTML={{ __html: PUZZLE_CSS }} />
      <svg
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          {CLIP_PATHS.map((shape) => (
            <clipPath key={shape.id} id={shape.id} clipPathUnits="objectBoundingBox">
              <path d={shape.d} />
            </clipPath>
          ))}
        </defs>
      </svg>

      <div className="container relative mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        <div className="mb-10 md:mb-16">
          <HomeSectionHeading
            id="featured-articles-title"
            title="مقالات منتخب تنادور"
            highlight="مقالات"
            subtitle="راهنماها، داستان‌ها و تازه‌ترین نگاه‌های دنیای ورزش"
          />
        </div>

        <div className="fa-grid">
          {articles.map((article, index) => (
            <Link
              key={article._id}
              href={buildArticlePath(article.category?.slug, article.slug) || "/articles"}
              aria-label={`مطالعه مقاله: ${article.title}`}
              className={`fa-piece fa-p${index} group bg-gray-900`}
            >
              <Image
                src={article.cover.url}
                alt={article.cover.alt || article.title}
                fill
                sizes={PIECE_SIZES[index]}
                className="object-cover object-center transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.05]"
              />
              {/* عنوان وسطِ کارت است، پس تیرگی باید در تمامِ سطح یکنواخت‌تر باشد
                  و فقط کمی به سمتِ پایین قوی‌تر شود. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/75 transition-opacity duration-300 group-hover:opacity-90"
              />
              <span className="fa-body transition-transform duration-300 motion-safe:group-hover:-translate-y-1">
                {article.category?.name ? (
                  <span className="mb-2.5 inline-flex rounded-[6px] border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    {article.category.name}
                  </span>
                ) : null}
                <span className="line-clamp-2 text-lg font-black leading-7 text-white drop-shadow-md xl:text-xl xl:leading-8">
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
