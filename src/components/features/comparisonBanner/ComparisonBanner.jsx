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

          {/* سمت راست: متن و محتوا — تایپوگرافی سیال مشترک با بنر تطبیق */}
          <div className="relative z-10 flex-1 min-w-0 text-right @2xl:pr-12">
            <h2 className="font-black text-white leading-tight text-[clamp(1.25rem,0.375rem_+_4.4cqw,3rem)] mb-[clamp(0.5rem,2.5cqw,1.5rem)]">
              ابزار هوشمند <br />
              <span className="text-[#aa4725]">مقایسه محصولات</span>
            </h2>

            <p className="text-gray-400 font-light max-w-md ml-0 ml-auto line-clamp-2 @lg:line-clamp-none text-[clamp(0.75rem,0.55rem_+_1cqw,1.125rem)] mb-[clamp(0.75rem,0.125rem_+_3.125cqw,2rem)]">
              مشخصات فنی را کنار هم بگذارید، نمودارها را تحلیل کنید و بهترین انتخاب را برای بازی خود داشته باشید.
            </p>

            <div className="inline-flex items-center bg-white text-[#20232a] rounded-[6px] font-black shadow-xl transition-all group-hover:scale-105 group-hover:bg-[#aa4725] group-hover:text-white gap-[clamp(0.5rem,0.3rem_+_0.8cqw,1rem)] px-[clamp(1rem,0.5rem_+_2.4cqw,2rem)] py-[clamp(0.75rem,0.6rem_+_0.8cqw,1rem)] text-[clamp(0.875rem,0.75rem_+_0.65cqw,1.125rem)]">
              <span>شروع مقایسه فنی</span>
              <FiChevronLeft className="shrink-0 group-hover:-translate-x-2 transition-transform size-[clamp(1.25rem,1.1rem_+_0.5cqw,1.5rem)]" />
            </div>
          </div>

          {/* سمت چپ: تصویر و المان بصری */}
          <div className="relative z-10 shrink-0 @lg:flex-1 flex justify-center items-center h-full @lg:min-h-[250px] @lg:w-full">
             {/* آیکون بزرگ مقایسه با استایل نئون */}
             <div className="relative">
                <div className="absolute inset-0 bg-[#aa4725] blur-[80px] opacity-20 rounded-[6px] animate-pulse"></div>
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