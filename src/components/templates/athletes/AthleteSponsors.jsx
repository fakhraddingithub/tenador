import AthleteSection from "@/components/templates/athletes/AthleteSection";

/**
 * اسپانسرهای ورزشکار — نمایشِ لوگو بدون قاب/کارت/پس‌زمینه با نامِ برند در زیرِ آن.
 * چیدمانِ گرید تا اندازه و فاصله‌ی همه‌ی لوگوها یکسان دیده شود.
 */
export default function AthleteSponsors({ sponsors = [] }) {
  const list = sponsors.filter((sponsor) => sponsor?.logo || sponsor?.name);
  if (list.length === 0) return null;

  return (
    <AthleteSection title="اسپانسرها" eyebrow="Sponsors">
      <ul className="grid grid-cols-3 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((sponsor) => (
          <li
            key={sponsor._id}
            className="flex flex-col items-center justify-start gap-3"
          >
            {sponsor.logo ? (
              <img
                src={sponsor.logo}
                alt={sponsor.name || ""}
                title={sponsor.name}
                width={160}
                height={64}
                loading="lazy"
                className="h-10 w-auto max-w-full object-contain opacity-80 transition-opacity duration-300 hover:opacity-100 sm:h-14"
              />
            ) : null}

            {sponsor.name ? (
              <span
                translate="no"
                className="text-center text-xs font-medium leading-5 text-gray-600 break-words"
              >
                {sponsor.name}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </AthleteSection>
  );
}
