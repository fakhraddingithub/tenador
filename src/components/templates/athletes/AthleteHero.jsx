import SportHero from "@/components/templates/sports/SportHero";

/**
 * هدرِ صفحه‌ی ورزشکار — دقیقاً همان SportHero سراسریِ سایت (تصویر تمام‌عرض +
 * گرادیان + عنوانِ وسط‌چین) با نامِ ورزشکار به‌عنوان عنوان و کاورِ رشته‌ی ورزشی
 * به‌عنوان پس‌زمینه.
 *
 * نبودِ کاورِ رشته → همان رفتارِ قبلی: عکسِ خودِ ورزشکار؛ و اگر آن هم نبود،
 * fallback داخلیِ خودِ SportHero عمل می‌کند.
 *
 * عکسِ پروفایل زیرِ هدر و نیمه‌روی آن (overlap) قرار می‌گیرد.
 */
export default function AthleteHero({ athlete }) {
  const headerImage = athlete.sport?.image || athlete.photo;

  return (
    <header>
      <SportHero
        image={headerImage}
        title={athlete.title}
        alt={athlete.title}
      />

      <div className="-mt-10 flex justify-center px-4 sm:-mt-14 lg:-mt-16">
        {athlete.photo ? (
          <img
            src={athlete.photo}
            alt={athlete.title}
            width={144}
            height={144}
            fetchPriority="high"
            className="h-24 w-24 rounded-full bg-gray-100 object-cover shadow-xl ring-4 ring-white sm:h-32 sm:w-32 lg:h-36 lg:w-36"
          />
        ) : (
          /* بدونِ عکس: دایره‌ی حرفِ اولِ نام تا چیدمان نشکند */
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-3xl font-black text-gray-400 shadow-xl ring-4 ring-white sm:h-32 sm:w-32 sm:text-4xl lg:h-36 lg:w-36"
          >
            {athlete.title?.trim().charAt(0)}
          </div>
        )}
      </div>
    </header>
  );
}
