/**
 * هدر (Hero) مشترکِ صفحه‌ی ورزش — تصویر تمام‌عرض + گرادیان + عنوان وسط‌چین.
 * این کامپوننت دقیقاً همان مارک‌آپِ قبلیِ inline در SportPageClient است که
 * استخراج شد تا بدون تکرار، در صفحه‌ی محصولات هم استفاده شود.
 *
 * props:
 *  - image: آدرس تصویر هدر (در نبودش به تصویر پیش‌فرض fallback می‌شود)
 *  - title: متن عنوان (h1)
 *  - alt: متن alt تصویر (پیش‌فرض = title)
 *  - headerExtra: اسلات اختیاری زیر عنوان (مثل شمارش معکوس رویداد)
 */
export default function SportHero({ image, title, alt = title, headerExtra = null }) {
  return (
    <div className="relative h-[100px] md:h-[220px] w-full overflow-hidden">
      <img
        src={image || "/images/default-sport.jpg"}
        alt={alt}
        className="w-full h-full object-cover scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

      <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
        {/* Title color: on the campaign page --event-text = the event's Title
            Color; on the Sport page the var is undefined → falls back to #fff
            (identical to the previous text-white). */}
        <h1
          className="text-xl md:text-4xl font-bold mb-4 drop-shadow-xl"
          style={{ color: "var(--event-text, #fff)" }}
        >
          {title}
        </h1>

        <div className="w-20 h-1 bg-[var(--color-primary)] rounded-full mb-4" />

        {/* Optional slot (event countdown) — Sport page passes nothing */}
        {headerExtra}
      </div>
    </div>
  );
}
