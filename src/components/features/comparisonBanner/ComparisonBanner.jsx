"use client";

import Link from "next/link";
import { FiChevronLeft } from "react-icons/fi";
import { MdCompareArrows } from "react-icons/md";

export default function ComparisonBanner() {
  return (
    <section className="@container py-6 md:py-12 w-full h-full">
      <Link href="/compare" className="block h-full">
        <div className="group relative w-full h-[30vh] min-h-[220px] max-h-[280px] @lg:h-full @lg:max-h-none @lg:min-h-[300px] @2xl:min-h-[350px] bg-[#20232a] overflow-hidden flex flex-row items-center justify-between px-5 @lg:px-8 @2xl:px-20 transition-all duration-500 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)]">

          {/* المان گرافیکی پس‌زمینه (رادار چارت محو) */}
          <div className="absolute inset-0 opacity-10 pointer-events-none z-0 flex justify-center items-center">
             <svg width="400" height="400" viewBox="0 0 100 100" className="text-white w-[220px] h-[220px] @lg:w-[400px] @lg:h-[400px]">
                <path d="M50 5 L95 25 L95 75 L50 95 L5 75 L5 25 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <path d="M50 20 L80 35 L80 65 L50 80 L20 65 L20 35 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
                <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="0.5" />
                <line x1="5" y1="25" x2="95" y2="75" stroke="currentColor" strokeWidth="0.5" />
                <line x1="5" y1="75" x2="95" y2="25" stroke="currentColor" strokeWidth="0.5" />
             </svg>
          </div>

          {/* سمت راست: متن و محتوا */}
          <div className="relative z-10 flex-1 min-w-0 text-right py-0 @2xl:pr-20">

            <h2 className="text-xl @lg:text-3xl @2xl:text-5xl font-black text-white mb-2 @lg:mb-6 leading-tight">
              ابزار هوشمند <br />
              <span className="text-[#aa4725]">مقایسه محصولات</span>
            </h2>

            <p className="text-gray-400 text-xs @lg:text-lg max-w-md ml-0 ml-auto mb-3 @lg:mb-8 font-light line-clamp-2 @lg:line-clamp-none">
              مشخصات فنی را کنار هم بگذارید، نمودارها را تحلیل کنید و بهترین انتخاب را برای بازی خود داشته باشید.
            </p>

            <div className="inline-flex items-center gap-2 @lg:gap-4 bg-white text-[#20232a] px-4 py-3 @lg:px-8 @lg:py-4 rounded-[6px] fon6pxk text-sm @lg:text-lg transition-all group-hover:bg-[#aa4725] group-hover:text-white group-hover:scale-105 shadow-xl">
              <span>شروع مقایسه فنی</span>
              <FiChevronLeft className="size-5 @lg:size-6 shrink-0 group-hover:-translate-x-2 transition-transform" />
            </div>
          </div>

          {/* سمت چپ: تصویر و المان بصری */}
          <div className="relative z-10 shrink-0 @lg:flex-1 flex justify-center items-center h-full @lg:min-h-[250px] @lg:w-full">
             {/* آیکون بزرگ مقایسه با استایل نئون */}
             <div className="relative">
                <div className="absolute inset-0 bg-[#aa4725] blur-[80px] opacity-20 rounded-[6px] animat6pxe"></div>
                <div className="relative bg-[#262932] border border-white/10 p-4 @lg:p-10 rounded-[6px] rotate-12 transition-transform duration-700 group-hover:rotate-0">
                   <MdCompareArrows className="size-12 @lg:size-[120px] text-white opacity-90" />
                </div>
                {/* المان‌های معلق */}
                <div className="absolute -top-2 -left-2 @lg:-top-4 @lg:-left-4 bg-[#aa4725] size-7 @lg:size-12 rounded-[6px] flex items-center justify-center text-white shadow-lg -rotate-12 group-hover:rotate-0 transition-all">
                   <span className="font-bold text-[10px] @lg:text-base">VS</span>
                </div>
             </div>
          </div>

        </div>
      </Link>
    </section>
  );
}