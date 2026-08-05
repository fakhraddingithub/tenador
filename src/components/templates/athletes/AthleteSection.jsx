/**
 * سرتیترِ مشترکِ بخش‌های صفحه‌ی ورزشکار — eyebrow لاتین + عنوان فارسی + خطِ محوشونده.
 * سرور-کامپوننت است (بدون state) تا صفحه‌ی ورزشکار کاملاً استاتیک بماند.
 *
 * props:
 *  - title: عنوان بخش (h2)
 *  - eyebrow: برچسبِ کوچکِ لاتین بالای عنوان (اختیاری)
 *  - children: محتوای بخش
 */
export default function AthleteSection({ title, eyebrow = null, children }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <span
              translate="no"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]"
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
