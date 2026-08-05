import Link from "next/link";
import { FaHandshake } from "react-icons/fa";
import AthleteSection from "@/components/templates/athletes/AthleteSection";

/**
 * اسپانسرهای ورزشکار — هر برند یک کارتِ کلیک‌پذیر که به صفحه‌ی همان برند می‌رود.
 * آدرس‌دهی دقیقاً مثل BrandsTicker: زیرِ ورزش (`/[sportSlug]/[brandSlug]`) و در
 * نبودِ اسلاگِ ورزش، ریشه (`/[brandSlug]`). برندِ بدون اسلاگ، کارتِ غیرِلینک
 * می‌شود تا لینکِ شکسته تولید نشود.
 */
export default function AthleteSponsors({ sponsors = [], sportSlug = null }) {
  const list = sponsors.filter((sponsor) => sponsor?.logo || sponsor?.name);
  if (list.length === 0) return null;

  const cardClass =
    "flex h-full flex-col items-center justify-center gap-3 rounded-[6px] border border-gray-200 bg-white p-5 text-center transition-colors duration-300";

  return (
    <AthleteSection title="اسپانسرها" eyebrow="Sponsors" icon={FaHandshake}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((sponsor) => {
          const name = sponsor.title || sponsor.name || "";

          const content = (
            <>
              {sponsor.logo ? (
                <img
                  src={sponsor.logo}
                  alt={name}
                  width={160}
                  height={64}
                  loading="lazy"
                  className="h-10 w-auto max-w-full object-contain sm:h-12"
                />
              ) : null}

              {name ? (
                <span
                  translate="no"
                  className="break-words text-xs font-bold leading-5 text-gray-700 sm:text-sm"
                >
                  {name}
                </span>
              ) : null}
            </>
          );

          return (
            <li key={sponsor._id}>
              {sponsor.slug ? (
                <Link
                  href={sportSlug ? `/${sportSlug}/${sponsor.slug}` : `/${sponsor.slug}`}
                  title={name}
                  className={`${cardClass} hover:border-[var(--color-primary)]/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}
                >
                  {content}
                </Link>
              ) : (
                <div className={cardClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </AthleteSection>
  );
}
