/**
 * عنوانِ بخش‌های صفحه‌ی اصلی. `highlight` بخشی از `title` است که با رنگِ اصلیِ
 * سایت می‌آید.
 *
 * برش روی *خودِ رشته* انجام می‌شود، نه واژه‌به‌واژه، تا چندواژه‌ای هم کار کند
 * (بلوکِ «تیتر تنادور» متنِ نارنجی را جدا می‌گیرد). برای همه‌ی فراخوانی‌های
 * تک‌واژه‌ایِ صفحه‌ی اصلی خروجیِ دیداری دقیقاً همان قبلی است.
 */
const segments = (title = "", highlight = "") => {
  const at = highlight ? String(title).indexOf(highlight) : -1;
  if (at < 0) return [[title, false]];
  return [[String(title).slice(0, at), false], [highlight, true], [String(title).slice(at + highlight.length), false]];
};

// as: تگِ عنوان. پیش‌فرض h2؛ جایی که عنوان نباید در ساختارِ تیترهای صفحه بیاید
// (مثلاً بخش‌های فرعیِ صفحه‌ی محصول) span می‌شود. block ظاهر را یکی نگه می‌دارد.
export default function HomeSectionHeading({ title, highlight, subtitle, id, as: Tag = "h2" }) {
  return (
    <div className="relative">
      <Tag id={id} className="block text-2xl font-black leading-tight text-gray-900 md:text-4xl">
        {segments(title, highlight).map(([text, on], index) => (text
          ? <span key={index} className={on ? "text-[var(--color-primary)]" : ""}>{text}</span>
          : null))}
      </Tag>
      <p className="mt-2 max-w-md border-r-2 border-[var(--color-primary)]/20 pr-3 text-sm font-light italic text-gray-500 md:mt-4 md:border-r-4 md:pr-4 md:text-lg">
        {subtitle}
      </p>
    </div>
  );
}
