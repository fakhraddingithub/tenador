import {
  FaBirthdayCake,
  FaFlag,
  FaRulerVertical,
  FaRunning,
  FaWeight,
} from "react-icons/fa";
import AthleteSection from "@/components/templates/athletes/AthleteSection";

/**
 * تاریخِ تولد به تقویمِ میلادی (Gregorian) و قالبِ DD/MM/YYYY.
 * en-GB دقیقاً همین ترتیب را می‌دهد. سرور-رندر است، پس اختلافِ hydration
 * پیش نمی‌آید. نمایش با dir="ltr" انجام می‌شود تا در صفحه‌ی RTL ترتیبِ
 * روز/ماه/سال معکوس دیده نشود.
 */
function gregorianDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * مشخصاتِ ورزشکار — کارت‌های آیکون‌دار. فقط فیلدهایی که داده دارند ساخته
 * می‌شوند؛ اگر هیچ‌کدام نبود، کلِ بخش رندر نمی‌شود.
 */
export default function AthleteInfo({ athlete }) {
  const birthDate = athlete.birthDate ? gregorianDate(athlete.birthDate) : null;

  const items = [
    athlete.sport?.title || athlete.sport?.name
      ? {
          icon: FaRunning,
          label: "رشته ورزشی",
          value: athlete.sport.title || athlete.sport.name,
        }
      : null,
    athlete.nationality
      ? { icon: FaFlag, label: "ملیت", value: athlete.nationality }
      : null,
    birthDate
      ? { icon: FaBirthdayCake, label: "تاریخ تولد", value: birthDate, ltr: true }
      : null,
    athlete.height != null
      ? {
          icon: FaRulerVertical,
          label: "قد",
          value: `${athlete.height} سانتی‌متر`,
        }
      : null,
    athlete.weight != null
      ? { icon: FaWeight, label: "وزن", value: `${athlete.weight} کیلوگرم` }
      : null,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <AthleteSection title="مشخصات ورزشکار" eyebrow="Profile" icon={FaRunning}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ icon: Icon, label, value, ltr }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2.5 rounded-[6px] border border-gray-200 bg-white px-3 py-5 text-center transition-colors duration-300 hover:border-[var(--color-primary)]/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Icon size={16} aria-hidden="true" />
            </span>

            <dt className="text-[11px] font-medium text-gray-500">{label}</dt>

            <dd
              {...(ltr ? { dir: "ltr" } : {})}
              className="break-words text-sm font-bold leading-6 text-gray-900"
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AthleteSection>
  );
}
