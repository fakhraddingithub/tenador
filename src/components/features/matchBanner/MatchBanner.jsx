"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FiChevronLeft, FiTarget } from "react-icons/fi";

// یک ردیف اسلایدر تزئینی — پر شدن نوار با هاور روی بنر جابه‌جا می‌شود
function TunerRow({ label, fill, hoverFill, delay }) {
  return (
    <div className="flex items-center gap-2 @lg:gap-3">
      <span className="text-[9px] @lg:text-xs font-bold text-gray-400 w-10 @lg:w-14 shrink-0">
        {label}
      </span>
      <div className="relative flex-1 h-1 @lg:h-1.5 rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 right-0 rounded-full bg-[#ffbf00] transition-all duration-700 ${delay} ${fill} ${hoverFill}`}
        />
      </div>
    </div>
  );
}

export default function MatchBanner() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="@container py-6 md:py-12 w-full h-full">
      <Link href="/match" className="block h-full">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="group relative w-full h-[30vh] min-h-[220px] max-h-[280px] @lg:h-full @lg:max-h-none @lg:min-h-[300px] @2xl:min-h-[350px] bg-gradient-to-bl from-[#2c1c10] via-[#241c14] to-[#20232a] overflow-hidden flex flex-row items-center justify-between px-5 @lg:px-8 @2xl:px-16 transition-all duration-500 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)]"
        >
          {/* المان گرافیکی پس‌زمینه (دایره‌های هدف محو) */}
          <div className="absolute inset-0 opacity-10 pointer-events-none z-0 flex justify-center items-center" aria-hidden="true">
            <svg width="400" height="400" viewBox="0 0 100 100" className="text-white w-[220px] h-[220px] @lg:w-[400px] @lg:h-[400px]">
              <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>

          {/* سمت راست: متن و محتوا — تایپوگرافی سیال مشترک با بنر مقایسه */}
          <div className="relative z-10 flex-1 min-w-0 text-right @2xl:pr-12">
            <h2 className="font-black text-white leading-tight text-[clamp(1.25rem,0.375rem_+_4.4cqw,3rem)] mb-[clamp(0.5rem,2.5cqw,1.5rem)]">
              انتخاب بعدی‌تان را <br />
              <span className="text-[#ffbf00]">هوشمندانه پیدا کنید</span>
            </h2>

            <p className="text-gray-400 font-light max-w-md ml-0 ml-auto line-clamp-2 @lg:line-clamp-none text-[clamp(0.75rem,0.55rem_+_1cqw,1.125rem)] mb-[clamp(0.75rem,0.125rem_+_3.125cqw,2rem)]">
              محصول فعلی خود را انتخاب کنید، شاخص‌های فنی را تنظیم کنید و نزدیک‌ترین گزینه‌ها را همان لحظه ببینید.
            </p>

            <div className="inline-flex items-center bg-white text-[#20232a] rounded-[6px] font-black shadow-xl transition-all group-hover:scale-105 group-hover:bg-[#ffbf00] gap-[clamp(0.5rem,0.3rem_+_0.8cqw,1rem)] px-[clamp(1rem,0.5rem_+_2.4cqw,2rem)] py-[clamp(0.75rem,0.6rem_+_0.8cqw,1rem)] text-[clamp(0.875rem,0.75rem_+_0.65cqw,1.125rem)]">
              <span>یافتن بهترین جایگزین</span>
              <FiChevronLeft className="shrink-0 group-hover:-translate-x-2 transition-transform size-[clamp(1.25rem,1.1rem_+_0.5cqw,1.5rem)]" />
            </div>
          </div>

          {/* سمت چپ: کارت تنظیم شاخص‌ها */}
          <div className="relative z-10 shrink-0 @lg:flex-1 flex justify-center items-center h-full @lg:min-h-[250px] @lg:w-full">
            <div className="relative">
              <div className="absolute inset-0 bg-[#ffbf00] blur-[80px] opacity-15 rounded-[6px] animate-pulse"></div>

              <div className="relative bg-[#262932] border border-white/10 p-3 @lg:p-6 rounded-[6px] -rotate-6 transition-transform duration-700 group-hover:rotate-0 w-[150px] @lg:w-[260px]">
                <div className="space-y-2 @lg:space-y-3.5">
                  <TunerRow label="قدرت" fill="w-[45%]" hoverFill="group-hover:w-[80%]" delay="delay-0" />
                  <TunerRow label="کنترل" fill="w-[70%]" hoverFill="group-hover:w-[55%]" delay="delay-100" />
                  <TunerRow label="اسپین" fill="w-[35%]" hoverFill="group-hover:w-[65%]" delay="delay-200" />
                </div>
                <div className="flex items-center justify-between mt-2.5 @lg:mt-5 pt-2 @lg:pt-3 border-t border-white/10">
                  <span className="text-[9px] @lg:text-xs text-gray-400 font-bold">درصد تطابق</span>
                  <span className="text-sm @lg:text-xl font-black text-[#ffbf00] tabular-nums">۹۴٪</span>
                </div>
              </div>

              {/* المان‌های معلق */}
              <div className="absolute -top-2 -left-2 @lg:-top-4 @lg:-left-4 [animation:match-float_5s_ease-in-out_infinite] motion-reduce:animate-none">
                <div className="bg-[#aa4725] size-7 @lg:size-12 rounded-[6px] flex items-center justify-center text-white shadow-lg -rotate-12 group-hover:rotate-0 transition-all">
                  <FiTarget className="size-3.5 @lg:size-6" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-3 @lg:-bottom-3 @lg:-right-6 [animation:match-float_6s_ease-in-out_1.5s_infinite] motion-reduce:animate-none">
                <div className="bg-[#ffbf00] text-[#20232a] text-[8px] @lg:text-[11px] font-black px-2 py-0.5 @lg:px-3 @lg:py-1 rounded-full shadow-lg rotate-6 group-hover:rotate-0 transition-all">
                  نزدیک‌ترین گزینه
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </section>
  );
}
