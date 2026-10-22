import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

/**
 * قابِ اسلایدرِ سری‌های صفحه‌ی ورزش — زمینه، هاله، واژه‌ی بزرگِ پس‌زمینه، عنوانِ
 * دورنگ با زیرعنوان، و دکمه‌های قبلی/بعدی در گوشه‌ی بالا-چپ.
 *
 * از SeriesSlider بیرون آمد تا اسلایدرِ نظرات *همین* قاب را داشته باشد، نه یک کپیِ
 * شبیه. خروجیِ SeriesSlider بایت‌به‌بایت همان قبلی است.
 *
 * دکمه‌ها یا با کلاس به Navigation ـِ Swiper وصل می‌شوند (prevClass/nextClass —
 * SeriesSlider) یا با onPrev/onNext.
 */
export function ShowcaseTitle({ highlight, title, subtitle }) {
  return (
    <>
      {highlight ? <span className="text-[#aa4725]">{highlight} </span> : null}{" "}
      {title}
      {subtitle ? (
        <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
          {subtitle}
        </p>
      ) : null}
    </>
  );
}

export default function SliderShowcase({ watermark, title, prevClass = "", nextClass = "", onPrev, onNext, showNav = true, paddingClass = "px-4 sm:px-8 md:px-16 lg:px-[90px]", children }) {
  return (
    <section className="py-12 md:py-24 bg-[#fcfcfc] relative overflow-hidden group/section">
      {/* هاله رنگی بک‌گراند */}
      <div className="absolute top-[-5%] left-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      {/* تایپوگرافی بزرگ بک‌گراند */}
      <div className="absolute top-8 left-6 text-[6rem] md:text-[15rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        {watermark}
      </div>

      <div
        className={`w-full max-w-[1800px] mx-auto relative z-10 ${paddingClass}`}
      >
        {/* هدر اورجینال به همراه دکمه‌های قبلی */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              {title}
            </h2>
          </div>

          {showNav ? (
            <div className="hidden md:flex items-center mt-8 md:mt-0">
              <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-[16px] p-1 border border-white/50">
                <button aria-label="قبلی" onClick={onPrev} className={`${prevClass} w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]`}>
                  <FiArrowRight size={22} />
                </button>

                <div className="w-[1px] h-6 bg-gray-100 self-center mx-1"></div>

                <button aria-label="بعدی" onClick={onNext} className={`${nextClass} w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]`}>
                  <FiArrowLeft size={22} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
