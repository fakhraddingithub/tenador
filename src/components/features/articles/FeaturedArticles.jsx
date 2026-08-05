import Image from "next/image";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import { buildArticlePath } from "base/utils/articleSlug";

const PIECES = [
  "lg:col-span-2 lg:row-span-2",
  "lg:col-span-4 lg:row-span-1",
  "lg:col-span-6 lg:row-span-2",
  "lg:col-span-4 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
  "lg:col-span-4 lg:row-span-1",
  "lg:col-span-4 lg:row-span-1",
];

const MOBILE_PIECES = [
  "col-span-2 min-h-72 md:col-span-2 md:row-span-2",
  "col-span-1 min-h-52 md:col-span-2 md:row-span-1",
  "col-span-1 min-h-52 md:col-span-2 md:row-span-2",
  "col-span-2 min-h-56 md:col-span-2 md:row-span-1",
  "col-span-1 min-h-52 md:col-span-1 md:row-span-1",
  "col-span-1 min-h-52 md:col-span-1 md:row-span-1",
  "col-span-2 min-h-56 md:col-span-2 md:row-span-1",
  "col-span-2 min-h-64 md:col-span-2 md:row-span-1",
];

// Each tab has a matching notch on the neighbouring piece. Positions are
// desktop-only because mobile intentionally uses its own compact composition.
const CONNECTIONS = {
  0: [{ type: "tab", side: "right", position: "65%" }],
  1: [
    { type: "tab", side: "right", position: "50%" },
    { type: "tab", side: "bottom", position: "52%" },
  ],
  2: [
    { type: "notch", side: "left", position: "25%" },
    { type: "notch", side: "left", position: "75%" },
    { type: "tab", side: "bottom", position: "75%" },
  ],
  3: [
    { type: "notch", side: "left", position: "50%" },
    { type: "notch", side: "top", position: "52%" },
    { type: "tab", side: "right", position: "50%" },
  ],
  4: [{ type: "tab", side: "right", position: "55%" }],
  5: [
    { type: "notch", side: "left", position: "55%" },
    { type: "tab", side: "right", position: "50%" },
  ],
  6: [
    { type: "notch", side: "left", position: "50%" },
    { type: "tab", side: "right", position: "50%" },
  ],
  7: [
    { type: "notch", side: "left", position: "50%" },
    { type: "notch", side: "top", position: "62.5%" },
  ],
};

const SIDE_STYLES = {
  right: { top: "var(--connector-position)", right: "-24px", transform: "translateY(-50%)" },
  left: { top: "var(--connector-position)", left: "-24px", transform: "translateY(-50%)" },
  top: { top: "-24px", left: "var(--connector-position)", transform: "translateX(-50%)" },
  bottom: { bottom: "-24px", left: "var(--connector-position)", transform: "translateX(-50%)" },
};

function PuzzleConnector({ connector, article }) {
  const style = {
    ...SIDE_STYLES[connector.side],
    "--connector-position": connector.position,
  };

  if (connector.type === "notch") {
    return (
      <span
        aria-hidden="true"
        style={style}
        className="pointer-events-none absolute z-30 hidden size-12 rounded-full bg-white lg:block"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={style}
      className="pointer-events-none absolute z-40 hidden size-12 overflow-hidden rounded-full bg-gray-900 shadow-sm lg:block"
    >
      <Image
        src={article.cover.url}
        alt=""
        fill
        sizes="48px"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-black/35" />
    </span>
  );
}

export default function FeaturedArticles({ articles = [] }) {
  if (articles.length !== 8) return null;

  return (
    <section
      className="relative overflow-hidden bg-white py-12 md:py-24"
      aria-labelledby="featured-articles-title"
    >
      <div className="container relative z-10 mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        <div className="mb-10 md:mb-16">
          <HomeSectionHeading
            id="featured-articles-title"
            title="مقالات منتخب تنادور"
            highlight="مقالات"
            subtitle="راهنماها، داستان‌ها و تازه‌ترین نگاه‌های دنیای ورزش"
          />
        </div>

        <div className="grid grid-cols-2 auto-rows-auto gap-4 md:grid-cols-4 md:auto-rows-[190px] lg:grid-cols-12 lg:auto-rows-[245px] xl:auto-rows-[285px]">
          {articles.map((article, index) => {
            const href = buildArticlePath(article.category.slug, article.slug) || "/articles";
            return (
              <Link
                key={article._id}
                href={href}
                aria-label={`مطالعه مقاله: ${article.title}`}
                className={`group relative block outline-none transition-[transform,filter] duration-300 hover:z-50 hover:-translate-y-1 hover:drop-shadow-xl focus-visible:z-50 focus-visible:ring-4 focus-visible:ring-[var(--color-primary)]/35 focus-visible:ring-offset-2 ${MOBILE_PIECES[index]} ${PIECES[index]}`}
              >
                <span className="absolute inset-0 overflow-hidden rounded-[6px] bg-gray-900 shadow-sm">
                  <Image
                    src={article.cover.url}
                    alt={article.cover.alt || article.title}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 34vw"
                    className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5 transition-opacity duration-300 group-hover:opacity-90" />
                </span>

                {(CONNECTIONS[index] || []).map((connector, connectorIndex) => (
                  <PuzzleConnector
                    key={`${connector.side}-${connectorIndex}`}
                    connector={connector}
                    article={article}
                  />
                ))}

                <span className="absolute inset-x-0 bottom-0 z-50 p-4 transition-transform duration-300 motion-safe:group-hover:-translate-y-1 md:p-5">
                  {article.category?.name ? (
                    <span className="mb-2 inline-flex rounded-[6px] border border-white/20 bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {article.category.name}
                    </span>
                  ) : null}
                  <span className="line-clamp-2 block text-base font-black leading-7 text-white drop-shadow-sm md:text-lg lg:text-xl">
                    {article.title}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
