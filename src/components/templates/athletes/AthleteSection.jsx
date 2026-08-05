/**
 * سرتیترِ مشترکِ بخش‌های صفحه‌ی ورزشکار — آیکون + eyebrow لاتین + عنوان فارسی
 * + خطِ محوشونده. سرور-کامپوننت است (بدون state) تا صفحه استاتیک بماند.
 *
 * props:
 *  - title: عنوان بخش (h2)
 *  - eyebrow: برچسبِ کوچکِ لاتین بالای عنوان (اختیاری)
 *  - icon: کامپوننتِ آیکون از react-icons (اختیاری)
 *  - children: محتوای بخش
 */
export default function AthleteSection({
  title,
  eyebrow = null,
  icon: Icon = null,
  children,
}) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        {Icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Icon size={18} aria-hidden="true" />
          </span>
        ) : null}

        <div className="min-w-0">
          {eyebrow ? (
            <span
              translate="no"
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]"
            >
              {eyebrow}
            </span>
          ) : null}

          <h2 className="text-balance text-xl font-black text-gray-900 sm:text-2xl">
            {title}
          </h2>
        </div>

        <div className="h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent" />
      </div>

      {children}
    </section>
  );
}
