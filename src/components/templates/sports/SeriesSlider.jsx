"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FiChevronLeft,
  FiArrowLeft,
  FiArrowRight,
} from "react-icons/fi";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

function splitName(name = "") {
  return name.trim().toUpperCase().split(/\s+/);
}

const GrungeFilter = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }}>
    <filter id="visage-grunge-heavy">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.6"
        numOctaves="4"
        result="noise"
      />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
    </filter>
  </svg>
);

function SerieCard({ serie, sportSlug, limited = false }) {
  const [hovered, setHovered] = useState(false);

  const primary = serie.colors?.primary || "#c0392b";
  const secondary = serie.colors?.secondary || "#e74c3c";
  const words = splitName(serie.name);

  const gradient = `
    linear-gradient(
      to top,
      ${primary} 0%,
      ${secondary} 100%
    )
  `;

  return (
    <Link href={`/${sportSlug}/series/${serie.slug}`} className="block w-full">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          relative
          flex-shrink-0
          w-full
          cursor-pointer
          select-none
          aspect-[2.8/4]
          transition-all
          duration-500
          ${hovered && limited ? "z-50" : "z-10"} 
        `}
      >
        {/* لایه بک‌گراند و ماسک (گوشه‌های گرد همیشه حفظ می‌شوند) */}
        <div
          className="absolute inset-0 rounded-[24px] shadow-xl transition-shadow duration-500 overflow-hidden group-hover:shadow-2xl"
          style={{ background: gradient }}
        >
          {/* گرادینت تاریک روی تصویر فقط برای Limited */}
          {limited && (
            <div
              className="absolute inset-0 z-[15]"
              style={{
                background: `
                  linear-gradient(
                    to top,
                    rgba(0,0,0,0.65) 0%,
                    rgba(0,0,0,0.05) 40%,
                    rgba(0,0,0,0.15) 100%
                  )
                `,
              }}
            />
          )}
        </div>

        {/* لوگو */}
        {(serie.logo || serie.brand?.logo) && (
          <div className="absolute top-4 left-5 z-40">
            <img
              src={serie.logo || serie.brand?.logo}
              alt={serie.title || serie.brand?.title || "logo"}
              className="h-[45px] md:h-[55px] w-auto object-contain transition-transform duration-500"
              style={{
                filter: "brightness(0) invert(1)",
                transform: hovered && limited ? "scale(1.05)" : "scale(1)",
              }}
            />
          </div>
        )}

        {/* تصویر (قابلیت بیرون زدن فقط برای لیمیتد) */}
        {serie.image && (
          <div
            className={`absolute inset-0 z-[20] flex items-center justify-center pointer-events-none ${
              limited ? "overflow-visible" : "overflow-hidden rounded-[24px]"
            }`}
          >
            <img
              src={serie.image}
              alt={serie.name}
              className="absolute transition-transform duration-500 ease-out"
              style={{
                /* معمولی کوچکتر است تا جا برای زوم داشته باشد، لیمیتد کامل پر میکند */
                width: limited ? "130%" : "100%",
                height: limited ? "130%" : "100%",
                objectFit: "contain",

                /* زوم شدیدتر برای لیمیتد که از کادر میزند بیرون */
                transform: hovered
                  ? limited
                    ? "scale(1.18) translateY(-2%)"
                    : "scale(1.06)"
                  : "scale(1)",

                /* سایه هوشمند که بیرون زدگی را جذاب‌تر می‌کند */
                filter: limited
                  ? "drop-shadow(0 30px 40px rgba(0,0,0,0.55))"
                  : "drop-shadow(0 15px 25px rgba(0,0,0,0.3))",
              }}
            />
          </div>
        )}

        {/* متن وسط کارت */}
        <div className="absolute inset-0 z-[30] flex flex-col items-center justify-center pointer-events-none px-2">
          {words.map((word, i) => (
            <span
              key={i}
              className="text-white leading-[0.85] text-center uppercase break-words"
              style={{
                /* فونت واکنش‌گرا: روی موبایل کوچک می‌شود، روی دسکتاپ بزرگ */
                fontSize: limited
                  ? "clamp(1.8rem, 4vw, 3.2rem)"
                  : "clamp(1.4rem, 2.5vw, 2.4rem)",
                fontWeight: "900",
                WebkitTextStroke: limited
                  ? "1.5px rgba(0,0,0,0.6)"
                  : "1px rgba(0,0,0,0.4)",
                textShadow: `
                  0 8px 0 rgba(0, 0, 0, 0.8),
                  0 3px 3px rgba(0, 0, 0, 0.6)
                `,
                filter: "url(#visage-grunge-heavy)",
                opacity: limited ? 1 : 0.85,
                letterSpacing: "-0.02em",
                transform: hovered && limited ? "scale(1.05)" : "scale(1)",
                transition: "transform 0.5s ease",
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* عنوان پایین کارت */}
        <div className="absolute bottom-5 right-5 z-40 text-right left-5">
          <h3
            className={`text-white font-black truncate transition-transform duration-500 ${
              limited ? "text-lg" : "text-base"
            }`}
            style={{
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
              transform: hovered && limited ? "translateY(-4px)" : "translateY(0)",
            }}
          >
            {serie.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

export default function SeriesSlider({ series = [], sportSlug, sportTitle }) {
  if (!series?.length) return null;

  const isLimitedEdition = series.every((s) => s.isLimitedEdition);

  // ─────────────────────────────────────────────
  // تنظیمات اسلایدر برای کارت‌های معمولی (۴ کارت در دسکتاپ)
  // ─────────────────────────────────────────────
  const regularBreakpoints = {
    0: { slidesPerView: 2.1, spaceBetween: 14 },
    640: { slidesPerView: 2.8, spaceBetween: 18 },
    768: { slidesPerView: 3.2, spaceBetween: 20 },
    1024: { slidesPerView: 4, spaceBetween: 24 }, // دقیقا 4 کارت
    1280: { slidesPerView: 4, spaceBetween: 28 }, 
  };

  // ─────────────────────────────────────────────
  // تنظیمات اسلایدر برای لیمیتد ادیشن (۳ کارت در دسکتاپ = کارت‌های بزرگتر)
  // ─────────────────────────────────────────────
  const limitedBreakpoints = {
    0: { slidesPerView: 2.1, spaceBetween: 16 }, // موبایل همچنان ۲ کارت است
    640: { slidesPerView: 2.2, spaceBetween: 20 },
    768: { slidesPerView: 2.5, spaceBetween: 24 },
    1024: { slidesPerView: 3, spaceBetween: 30 }, // دقیقا 3 کارت بزرگ
    1280: { slidesPerView: 3, spaceBetween: 36 },
  };

  return (
    <section className="py-12 px-4 lg:px-8 md:py-20 bg-[#fcfcfc] relative overflow-hidden group/section">
      <div className="absolute top-[-5%] left-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      <div className="absolute top-8 left-6 text-[6rem] md:text-[12rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        SERIES
      </div>

      <div className="w-full max-w-[1600px] mx-auto relative z-10">
        <div className="relative flex flex-row items-end justify-between mb-10 md:mb-14">
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              {isLimitedEdition ? (
                <>
                  <span className="text-[#aa4725]">لیمیتد ادیشن‌های </span> 2026
                </>
              ) : (
                <>
                  <span className="text-[#aa4725]">سری‌های </span> {sportTitle}
                </>
              )}
            </h2>
            <p className="text-gray-400 mt-2 text-sm md:text-base font-light max-w-md border-r-2 border-[#aa4725]/20 pr-3 md:pr-4 italic">
              حرفه‌ای‌ترین کالکشن‌های 2026
            </p>
          </div>

          <div className="hidden md:flex items-center">
            <div className="flex bg-white/80 backdrop-blur-md shadow-lg shadow-black/5 rounded-[14px] p-1.5 border border-white/50">
              <button className="series-prev-btn w-11 h-11 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[10px]">
                <FiArrowRight size={20} />
              </button>
              <div className="w-[1px] h-6 bg-gray-100 self-center mx-2"></div>
              <button className="series-next-btn w-11 h-11 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[10px]">
                <FiArrowLeft size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 
          برای کارت‌های لیمیتد از !overflow-visible استفاده می‌کنیم 
          تا موقع هاور عکس‌های پاپ‌آپ از کل کادر اسلایدر کات نشوند.
          پدینگ عمودی (py-6) هم به اسلایدر فضا می‌دهد تا بیرون‌زدگی به بالا/پایین برخورد نکند.
        */}
        <div className={`relative w-full ${isLimitedEdition ? "!overflow-visible" : ""}`}>
          <GrungeFilter />
          <Swiper
            className={`${isLimitedEdition ? "!overflow-visible" : ""}`}
            modules={[Navigation, Pagination, Autoplay]}
            watchOverflow={true}
            centeredSlides={false}
            autoplay={{
              delay: 4500,
              disableOnInteraction: true,
            }}
            navigation={{
              nextEl: ".series-next-btn",
              prevEl: ".series-prev-btn",
            }}
            pagination={{
              el: ".series-pagination",
              clickable: true,
            }}
            breakpoints={
              isLimitedEdition ? limitedBreakpoints : regularBreakpoints
            }
          >
            {series.map((serie, index) => (
              <SwiperSlide key={serie._id || index} className="h-auto pb-12 pt-6">
                <div className="h-full">
                  <SerieCard
                    serie={serie}
                    sportSlug={sportSlug}
                    limited={isLimitedEdition}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 mt-2 md:mt-6">
          <div className="series-pagination !w-auto flex gap-1.5"></div>
          <Link
            href={`/${sportSlug}/series`}
            className="group flex items-center gap-2 bg-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 justify-center"
          >
            مشاهده همه سری‌ها
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <FiChevronLeft className="text-lg md:text-xl" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}