import SportHero from "@/components/templates/sports/SportHero";

/**
 * هدرِ صفحه‌ی ورزشکار — بنرِ تمام‌عرض از کاورِ رشته‌ی ورزشی، عکسِ پروفایلِ
 * روی‌هم‌افتاده با لبه‌ی پایینِ بنر و بلوکِ هویتی (نام + مشخصات) زیرِ آن.
 *
 * اگر رشته‌ی ورزشی کاور نداشته باشد، به چیدمانِ قبلی (SportHero با عکسِ خودِ
 * ورزشکار) برمی‌گردد؛ در آن حالت h1 را خودِ SportHero رندر می‌کند و اینجا فقط
 * نوارِ مشخصات نمایش داده می‌شود.
 */
const avatarSize = "h-28 w-28 sm:h-40 sm:w-40 lg:h-44 lg:w-44";

export default function AthleteHero({ athlete }) {
  const cover = athlete.sport?.image;

  const specs = [
    athlete.sport?.title && { label: "رشته ورزشی", value: athlete.sport.title },
    {
      label: "جنسیت",
      value: athlete.gender === "female" ? "بانوان" : "آقایان",
    },
    athlete.nationality && { label: "ملیت", value: athlete.nationality },
    athlete.height != null && {
      label: "قد",
      value: `${athlete.height} سانتی‌متر`,
    },
    athlete.weight != null && {
      label: "وزن",
      value: `${athlete.weight} کیلوگرم`,
    },
    athlete.birthDate && {
      label: "تاریخ تولد",
      value: new Date(athlete.birthDate).toLocaleDateString("fa-IR"),
    },
  ].filter(Boolean);

  return (
    <header>
      {cover ? (
        <>
          <div className="relative h-[170px] w-full overflow-hidden sm:h-[260px] lg:h-[340px]">
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              width={1920}
              height={680}
              fetchPriority="high"
              className="h-full w-full scale-105 object-cover"
            />

            {/* لایه‌ی تیره برای عمق + محوشدنِ نرم به بدنه‌ی سفیدِ صفحه */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-background)] to-transparent" />
          </div>

          {/* عکسِ پروفایل، نیمه روی بنر */}
          <div className="-mt-14 flex justify-center px-4 sm:-mt-20 lg:-mt-24">
            {athlete.photo ? (
              <img
                src={athlete.photo}
                alt={athlete.title}
                width={176}
                height={176}
                fetchPriority="high"
                className={`${avatarSize} rounded-full bg-gray-100 object-cover shadow-xl ring-4 ring-white`}
              />
            ) : (
              /* بدونِ عکس: دایره‌ی حرفِ اولِ نام تا چیدمان نشکند */
              <div
                aria-hidden="true"
                className={`${avatarSize} flex items-center justify-center rounded-full bg-gray-100 text-3xl font-black text-gray-400 shadow-xl ring-4 ring-white sm:text-5xl`}
              >
                {athlete.title?.trim().charAt(0)}
              </div>
            )}
          </div>
        </>
      ) : (
        <SportHero
          image={athlete.photo}
          title={athlete.title}
          alt={athlete.title}
        />
      )}

      <div className="mx-auto max-w-4xl px-4 pt-6 text-center sm:pt-8">
        {cover ? (
          <>
            {athlete.sport?.name ? (
              <span
                translate="no"
                className="mb-2 block text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]"
              >
                {athlete.sport.name}
              </span>
            ) : null}

            <h1 className="text-balance text-2xl font-black leading-tight text-gray-900 sm:text-4xl">
              {athlete.title}
            </h1>

            <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-[var(--color-primary)]" />
          </>
        ) : null}

        {specs.length > 0 ? (
          <dl className="mt-7 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="rounded-[6px] border border-gray-200 bg-white px-4 py-3 text-center sm:min-w-[130px]"
              >
                <dt className="text-[11px] font-medium text-gray-500">
                  {spec.label}
                </dt>
                <dd className="mt-1 break-words text-sm font-bold text-gray-900">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
