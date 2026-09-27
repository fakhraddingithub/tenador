import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

/**
 * دکمه‌های عقب/جلوی اسلایدرهای صفحه‌ی اصلی.
 *
 * عیناً همان مارک‌آپی است که در BestSellers بود؛ اینجا آمد تا بلوکِ ادغام‌شده‌ی
 * مقاله هم *همان* دکمه‌ها را داشته باشد، نه یک کپیِ شبیه. صفحه‌ی اصلی با
 * کلاس‌های هوک به Swiper وصل می‌شود (prevClass/nextClass) و جای دیگر با
 * onPrev/onNext — خروجیِ رندر در هر دو حالت یکی است.
 *
 * prevDisabled/nextDisabled فقط جایی استفاده می‌شود که خودمان ابتدا/انتها را
 * می‌دانیم؛ صفحه‌ی اصلی آن‌ها را نمی‌فرستد، پس خروجی‌اش بدونِ تغییر است.
 */
export default function HomeSliderNav({
  prevClass = "",
  nextClass = "",
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  className = "hidden md:flex items-center mt-8 md:mt-0",
  label,
}) {
  const button = "w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all rounded-lg disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className={className} {...(label ? { role: "group", "aria-label": label } : null)}>
      <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-xl p-1 border border-white/50">
        <button className={`${prevClass} ${button}`.trim()} onClick={onPrev} disabled={prevDisabled} aria-label="قبلی">
          <FiArrowRight size={22} />
        </button>

        <div className="w-[1px] h-6 bg-gray-100 self-center mx-1" />

        <button className={`${nextClass} ${button}`.trim()} onClick={onNext} disabled={nextDisabled} aria-label="بعدی">
          <FiArrowLeft size={22} />
        </button>
      </div>
    </div>
  );
}
