/**
 * PageHero — هدرِ ایمرسیوِ صفحات اطلاع‌رسانی.
 * هم‌خانواده با SportHero (تصویر تمام‌عرض + گرادیان + عنوان وسط‌چین) اما بلندتر،
 * با eyebrow، زیرعنوان و رنگِ تأکیدِ مخصوص هر صفحه (accent).
 *
 * سرور-کامپوننت است؛ ورودِ عناصر با انیمیشن CSS (بدون JS) انجام می‌شود تا
 * بالای صفحه بدون اسپینر/پرش رندر شود.
 *
 * از <img> ساده استفاده می‌شود (نه next/image) چون لودرِ سفارشیِ Cloudinary
 * پروژه با آدرس‌های غیرکلودیناری (placeholder) ناسازگار است.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  accent = "#aa4725",
  align = "center",
}) {
  const alignClass =
    align === "right"
      ? "items-end text-right"
      : align === "left"
      ? "items-start text-left"
      : "items-center text-center";

  return (
    <section className="relative h-[58vh] min-h-[420px] max-h-[640px] w-full overflow-hidden">
      <img
        src={image || "/images/default-sport.jpg"}
        alt={title || ""}
        className="absolute inset-0 w-full h-full object-cover scale-105"
        fetchPriority="high"
      />

      {/* لایه‌های گرادیان: تیره از پایین + رنگِ تأکید از یک گوشه */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 z-10" />
      <div
        className="absolute inset-0 z-10 opacity-60 mix-blend-multiply"
        style={{
          background: `radial-gradient(120% 90% at 80% 0%, ${accent}55 0%, transparent 55%)`,
        }}
      />

      <div
        className={`relative z-20 h-full max-w-5xl mx-auto px-5 flex flex-col justify-center ${alignClass}`}
      >
        {eyebrow ? (
          <span
            className="animate-fadeIn inline-flex items-center gap-2 self-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold text-white backdrop-blur-md mb-5"
            style={{
              background: `${accent}33`,
              border: `1px solid ${accent}66`,
              animationFillMode: "backwards",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: accent }}
            />
            {eyebrow}
          </span>
        ) : null}

        <h1
          className="animate-fadeIn text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight drop-shadow-2xl"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
        >
          {title}
        </h1>

        <div
          className="animate-fadeIn h-1.5 w-24 rounded-full my-6"
          style={{ background: accent, animationDelay: "160ms", animationFillMode: "backwards" }}
        />

        {subtitle ? (
          <p
            className="animate-fadeIn max-w-2xl text-base sm:text-lg text-white/85 leading-relaxed"
            style={{ animationDelay: "220ms", animationFillMode: "backwards" }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* موجِ پایینی برای اتصال نرم به بدنه */}
      <div className="absolute -bottom-px left-0 right-0 z-20 h-12 bg-gradient-to-t from-[var(--color-background)] to-transparent" />
    </section>
  );
}
