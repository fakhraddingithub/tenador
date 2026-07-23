"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FiChevronLeft, FiTarget } from "react-icons/fi";
import { MdAutoAwesome } from "react-icons/md";

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

          {/* سمت راست: متن و محتوا */}
          <div className="relative z-10 flex-1 min-w-0 text-right py-0 @2xl:pr-14">
            <div className="inline-flex items-center gap-1.5 bg-[#ffbf00]/10 border border-[#ffbf00]/25 text-[#ffbf00] text-[10px] @lg:text-xs font-bold px-2.5 py-1 rounded-full mb-2 @lg:mb-4">
              <MdAutoAwesome className="size-3 @lg:size-4" />
              تطبیق هوشمند محصول
            </div>

            <h2 className="text-xl @lg:text-3xl @2xl:text-5xl font-black text-white mb-2 @lg:mb-6 leading-tight">
              انتخاب بعدی‌تان را <br />
              <span className="text-[#ffbf00]">هوشمندانه پیدا کنید</span>
            </h2>

            <p className="text-gray-400 text-xs @lg:text-lg max-w-md mb-3 @lg:mb-8 font-light line-clamp-2 @lg:line-clamp-none">
              محصول فعلی خود را انتخاب کنید، شاخص‌های فنی را تنظیم کنید و نزدیک‌ترین گزینه‌ها را همان لحظه ببینید.
            </p>

            <div className="inline-flex items-center gap-2 @lg:gap-4 bg-white text-[#20232a] px-4 py-3 @lg:px-8 @lg:py-4 rounded-[6px] font-black text-sm @lg:text-lg transition-all group-hover:bg-[#ffbf00] group-hover:scale-105 shadow-xl">
              <span>یافتن بهترین جایگزین</span>
              <FiChevronLeft className="size-5 @lg:size-6 shrink-0 group-hover:-translate-x-2 transition-transform" />
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
