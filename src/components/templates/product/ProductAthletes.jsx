import Image from "next/image";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";

/**
 * «ورزشکارانی که از این محصول استفاده می‌کنند» — بینِ تب‌ها و مزایای خرید.
 * داده همان product.athlete است که getProductBySlug فقط با title/slug/photo
 * populate می‌کند. ورزشکارِ حذف‌شده یا بی‌اسلاگ کنار گذاشته می‌شود و بدونِ
 * هیچ ورزشکاری کلِ بخش رندر نمی‌شود.
 *
 * موبایل: ردیفِ افقیِ قابلِ اسکرول با snap؛ از sm به بالا: گرید.
 */
export default function ProductAthletes({ athletes }) {
  const list = (athletes || []).filter((a) => a?.slug && a?.title);
  if (!list.length) return null;

  return (
    <section aria-labelledby="product-athletes-heading" className="mt-10 sm:mt-12 md:mt-16">
      <HomeSectionHeading
        id="product-athletes-heading"
        as="span"
        title="ورزشکارانِ این محصول"
        highlight="ورزشکارانِ"
        subtitle="حرفه‌ای‌هایی که در مسابقات به این محصول اعتماد کرده‌اند"
      />

      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 md:mt-8 lg:grid-cols-6">
        {list.map((athlete) => (
          <li key={athlete._id || athlete.slug} className="w-36 shrink-0 snap-start sm:w-auto">
            <AthleteCard athlete={athlete} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AthleteCard({ athlete }) {
  return (
    <Link
      href={`/athletes/${athlete.slug}`}
      className="group relative block h-full overflow-hidden rounded-[var(--radius)] bg-white shadow-sm ring-1 ring-gray-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-[var(--color-primary)]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-[var(--color-primary)]/5 via-gray-50 to-[var(--color-secondary)]/10">
        {athlete.photo ? (
          <Image
            src={athlete.photo}
            alt={athlete.title}
            fill
            sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 144px"
            className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-5xl font-black text-[var(--color-primary)]/30"
          >
            {athlete.title.trim().charAt(0)}
          </span>
        )}
        {/* سایه‌ی پایینِ عکس تا مرزِ عکس و نام نرم شود */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="relative px-3 pb-3.5 pt-3 text-center sm:pb-4">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full bg-[var(--color-secondary)] transition-all duration-300 group-hover:w-16 group-hover:bg-[var(--color-primary)]"
        />
        <h3 className="truncate text-sm font-bold text-gray-900 sm:text-base">{athlete.title}</h3>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 transition-colors group-hover:text-[var(--color-primary)] sm:text-xs">
          مشاهده‌ی پروفایل
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
        </span>
      </div>
    </Link>
  );
}
