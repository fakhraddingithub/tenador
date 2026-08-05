import { FaMedal, FaTrophy } from "react-icons/fa";
import Reveal from "@/components/pages/Reveal";
import AthleteSection from "@/components/templates/athletes/AthleteSection";

/**
 * افتخاراتِ ورزشکار به‌عنوانِ «بخشِ شاخصِ» صفحه:
 *  ۱) پنلِ تیره‌ی آمار — با همان زبانِ بصریِ ShowcaseAthletes (پس‌زمینه‌ی #1a1c22
 *     و هاله‌های محو) تا از بقیه‌ی صفحه‌ی روشن جدا و برجسته شود.
 *  ۲) گریدِ کارت‌ها — هر افتخار یک کارتِ مستقل با شماره‌ی محوِ پس‌زمینه (همان
 *     ایده‌ی rank در ShowcaseAthletes)، تعدادِ تکرار با تایپوگرافیِ درشت، و
 *     نوارِ تأکیدِ پایین که با hover باز می‌شود.
 *
 * انیمیشنِ ورود از کامپوننتِ مشترکِ Reveal گرفته شده (framer-motion + احترام به
 * prefers-reduced-motion) تا با بقیه‌ی صفحاتِ سایت یکسان باشد.
 */
export default function AthleteAchievements({ honors = [] }) {
  const list = honors
    .filter((honor) => honor?.title)
    .map((honor) => ({
      title: honor.title,
      description: honor.description,
      count: Number(honor.quantity) > 0 ? Number(honor.quantity) : 1,
    }));

  if (list.length === 0) return null;

  const totalTitles = list.length;
  const totalWins = list.reduce((sum, honor) => sum + honor.count, 0);

  const stats = [
    { icon: FaMedal, value: totalWins, label: "قهرمانی و مدال" },
    ...(totalTitles !== totalWins
      ? [{ icon: FaTrophy, value: totalTitles, label: "عنوان متمایز" }]
      : []),
  ];

  return (
    <AthleteSection title="افتخارات" eyebrow="Achievements" icon={FaTrophy}>
      <Reveal>
        <div className="relative overflow-hidden rounded-[6px] bg-[#1a1c22] px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />
            <div className="absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-white/[0.04] blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
            <div className="max-w-sm">
              <span
                translate="no"
                className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-secondary)]"
              >
                Career Highlights
              </span>

              <p className="text-pretty text-sm leading-7 text-gray-400">
                کارنامه‌ی افتخاراتِ ثبت‌شده در پروفایلِ این ورزشکار.
              </p>
            </div>

            <dl className="flex flex-wrap items-start gap-x-10 gap-y-6 sm:gap-x-12">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="mt-2 text-[var(--color-secondary)]/70">
                    <Icon size={16} aria-hidden="true" />
                  </span>

                  <div>
                    <dd className="text-5xl font-black leading-none tabular-nums text-[var(--color-secondary)] sm:text-6xl">
                      {value}
                    </dd>
                    <dt className="mt-2 text-xs font-medium text-gray-400">
                      {label}
                    </dt>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((honor, index) => (
          <li key={`${honor.title}-${index}`} className="h-full">
            <Reveal className="h-full" y={20} delay={Math.min(index, 5) * 0.06}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-[6px] border border-gray-200 bg-white p-6 transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-lg">
                {/* شماره‌ی محوِ پس‌زمینه — همان ایده‌ی rank در ShowcaseAthletes */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1 select-none text-6xl font-black italic tabular-nums leading-none text-gray-900/[0.05] transition-colors duration-500 group-hover:text-[var(--color-primary)]/10"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="relative flex h-11 w-11 origin-center items-center justify-center rounded-[6px] bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] transition-transform duration-500 group-hover:scale-110">
                  <FaTrophy size={18} aria-hidden="true" />
                </span>

                <p className="relative mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black leading-none tabular-nums text-[var(--color-primary)]">
                    {honor.count}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400">
                    مرتبه
                  </span>
                </p>

                <h3 className="relative mt-3 text-balance font-bold leading-7 text-gray-900">
                  {honor.title}
                </h3>

                {honor.description ? (
                  <p className="relative mt-2 text-pretty text-sm leading-6 text-gray-500">
                    {honor.description}
                  </p>
                ) : null}

                {/* نوارِ تأکیدِ پایین — از راست باز می‌شود (RTL) */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[3px] origin-right scale-x-0 bg-[var(--color-primary)] transition-transform duration-500 group-hover:scale-x-100"
                />
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </AthleteSection>
  );
}
