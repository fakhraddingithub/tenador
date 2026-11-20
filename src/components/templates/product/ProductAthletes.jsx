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
          <li key={athlete._id || athlete.slug} className="w-32 shrink-0 snap-start sm:w-auto">
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
      className="group flex flex-col items-center gap-3 rounded-[var(--radius)] p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    >
      {/* عکسِ پروفایلِ گرد؛ با هاور یک دایره‌ی primary دورش کشیده می‌شود */}
      <span className="relative block aspect-square w-full max-w-36">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -inset-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+0.75rem)] -rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r="48.5"
            fill="none"
            pathLength="1"
            strokeWidth="2"
            className="stroke-[var(--color-primary)] opacity-0 transition-[stroke-dashoffset,opacity] duration-700 ease-out [stroke-dasharray:1] [stroke-dashoffset:1] group-hover:opacity-100 group-hover:[stroke-dashoffset:0] group-focus-visible:opacity-100 group-focus-visible:[stroke-dashoffset:0]"
          />
        </svg>
        <span className="relative block size-full overflow-hidden rounded-full bg-gray-100">
          {athlete.photo ? (
            <Image
              src={athlete.photo}
              alt={athlete.title}
              fill
              sizes="144px"
              // زوم روی چهره: عکس از بالا بریده و بزرگ می‌شود تا صورت دایره را پر کند
              className="origin-[50%_20%] scale-[1.35] object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.45]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center text-4xl font-black text-[var(--color-primary)]/30"
            >
              {athlete.title.trim().charAt(0)}
            </span>
          )}
        </span>
      </span>
      <h3 className="w-full truncate text-sm font-bold text-gray-900 transition-colors group-hover:text-[var(--color-primary)] sm:text-base">
        {athlete.title}
      </h3>
    </Link>
  );
}
