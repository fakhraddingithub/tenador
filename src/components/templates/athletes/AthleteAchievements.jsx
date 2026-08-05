import { FaAward, FaMedal, FaTrophy } from "react-icons/fa";
import AthleteSection from "@/components/templates/athletes/AthleteSection";

/**
 * افتخاراتِ ورزشکار — آمارِ برجسته (تعداد عناوین و مجموع قهرمانی‌ها) به‌علاوه‌ی
 * کارتِ اختصاصی برای هر افتخار. اگر افتخارِ معتبری نباشد، بخش رندر نمی‌شود.
 */
export default function AthleteAchievements({ honors = [] }) {
  const list = honors.filter((honor) => honor?.title);
  if (list.length === 0) return null;

  const totalTitles = list.length;
  const totalWins = list.reduce(
    (sum, honor) => sum + (Number(honor.quantity) > 0 ? Number(honor.quantity) : 1),
    0,
  );

  const stats = [
    { icon: FaAward, value: totalTitles, label: "عنوان ثبت‌شده" },
    ...(totalWins > totalTitles
      ? [{ icon: FaMedal, value: totalWins, label: "مجموع قهرمانی‌ها" }]
      : []),
  ];

  return (
    <AthleteSection title="افتخارات" eyebrow="Achievements" icon={FaTrophy}>
      <div className="grid gap-3 sm:grid-cols-2">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-[6px] border border-gray-200 bg-white px-5 py-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[6px] bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]">
              <Icon size={20} aria-hidden="true" />
            </span>

            <span className="text-4xl font-black leading-none tabular-nums text-[var(--color-primary)] sm:text-5xl">
              {value}
            </span>

            <span className="min-w-0 text-sm font-medium text-gray-500">
              {label}
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((honor, index) => (
          <li
            key={`${honor.title}-${index}`}
            className="flex gap-4 rounded-[6px] border border-gray-200 bg-white p-5 transition-colors duration-300 hover:border-[var(--color-primary)]/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]">
              <FaTrophy size={16} aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-gray-900">
                <span className="break-words">{honor.title}</span>

                {honor.quantity > 1 ? (
                  <span className="rounded-[6px] bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-600">
                    ×&nbsp;{honor.quantity}
                  </span>
                ) : null}
              </p>

              {honor.description ? (
                <p className="mt-1.5 text-pretty text-sm leading-6 text-gray-500">
                  {honor.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </AthleteSection>
  );
}
