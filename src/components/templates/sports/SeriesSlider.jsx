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
        className="
          relative
          flex-shrink-0
          w-full
          rounded-[20px]
          overflow-hidden
          cursor-pointer
          select-none
          shadow-xl
          aspect-[3/4]
          transition-shadow
          duration-300
          hover:shadow-2xl
        "
        style={{
          background: gradient,
        }}
      >
        {/* لوگو */}
        {(serie.logo || serie.brand?.logo) && (
          <div className="absolute top-3 left-4 z-40">
            <img
              src={serie.logo || serie.brand?.logo}
              alt={serie.title || serie.brand?.title || "logo"}
              className="h-[40px] md:h-[50px] w-auto object-contain"
              style={{
                filter: "brightness(0) invert(1)",
              }}
            />
          </div>
        )}

        {/* تصویر اصلاح شده */}
        {serie.image && (
          <div className={`absolute inset-0 z-[10] ${limited ? "overflow-visible" : "overflow-hidden"}`}>
            <img
              src={serie.image}
              alt={serie.name}
              className="absolute transition-transform duration-500 ease-out"
              style={{
                /* ابعاد استاندارد شده و متناسب با کارت */
                width: limited ? "100%" : "85%",
                height: limited ? "100%" : "85%",
                objectFit: "contain",

                /* قرارگیری دقیق در مرکز کارت */
                top: "50%",
                left: "50%",

                transform: hovered
                  ? "translate(-50%, -50%) scale(1.08)"
                  : "translate(-50%, -50%) scale(1)",

                /* سایه‌ هوشمند */
                filter: limited
                  ? "drop-shadow(0 25px 40px rgba(0,0,0,0.5))"
                  : "drop-shadow(0 12px 25px rgba(0,0,0,0.25))",

                maxWidth: "unset",
                maxHeight: "unset",
              }}
            />
          </div>
        )}

        {/* متن روی کارت با سایز استاندارد شده برای جلوگیری از بیرون زدگی */}
        <div className="absolute inset-0 z-[20] flex flex-col items-center justify-center pointer-events-none px-2">
          {words.map((word, i) => (
            <span
              key={i}
              className="text-white leading-[0.85] text-center uppercase break-all"
              style={{
                fontSize: limited ? "2.4rem" : "1.9rem",
                fontWeight: "900",
                WebkitTextStroke: limited
                  ? "1.5px rgba(0,0,0,0.5)"
                  : "1px rgba(0,0,0,0.4)",

                textShadow: `
                  0 6px 0 rgba(0, 0, 0, 0.8),
                  0 2px 2px rgba(0, 0, 0, 0.6)
                `,
                filter: "url(#visage-grunge-heavy)",
                opacity: limited ? 1 : 0.85,
                letterSpacing: "-0.02em",
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* گرادینت تاریک روی تصویر فقط برای Limited */}
        {limited && (
          <div
            className="absolute inset-0 z-[15]"
            style={{
              background: `
                linear-gradient(
                  to top,
                  rgba(0,0,0,0.6) 0%,
                  rgba(0,0,0,0.05) 40%,
                  rgba(0,0,0,0.1) 100%
                )
              `,
            }}
          />
        )}

        {/* عنوان پایین کارت */}
        <div className="absolute bottom-4 right-4 z-30 text-right left-4">
          <h3
            className={`text-white font-black truncate ${
              limited ? "text-base" : "text-sm"
            }`}
            style={{
              textShadow: "0 2px 8px rgba(0,0,0,0.7)",
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

  // تنظیمات اسلایدر مشترک و بهینه شده برای هر دو حالت
  const sliderBreakpoints = {
    0: {
      slidesPerView: 2.1, // نمایش ۲ کارت کامل و یک بخش کوچک از کارت سوم در موبایل
      spaceBetween: 12,
    },
    480: {
      slidesPerView: 2.3,
      spaceBetween: 14,
    },
    640: {
      slidesPerView: 2.8,
      spaceBetween: 16,
    },
    768: {
      slidesPerView: 3.2,
      spaceBetween: 20,
    },
    1024: {
      slidesPerView: 4, // استاندارد شدن ابعاد در دسکتاپ
      spaceBetween: 24,
    },
    1280: {
      slidesPerView: 4.5,
      spaceBetween: 24,
    }
  };

  // ─────────────────────────────────────────────
  // Limited Edition Layout
  // ─────────────────────────────────────────────
  if (isLimitedEdition) {
    return (
      <section className="py-10 px-4 lg:px-8 md:py-16 bg-[#fcfcfc] relative overflow-hidden group/section">
        <div className="absolute top-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />

        <div className="absolute top-6 left-6 text-[5rem] md:text-[10rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
          SERIES
        </div>

        <div className="w-full relative z-10">
          <div className="relative flex flex-row items-end justify-between mb-8 md:mb-12">
            <div className="relative">
              <h2 className="text-xl md:text-3xl font-black text-gray-900 leading-tight">
                <span className="text-[#aa4725]">لیمیتد ادیشن‌های </span> 2026
              </h2>
              <p className="text-gray-400 mt-1 md:mt-2 text-xs md:text-sm font-light max-w-md border-r-2 border-[#aa4725]/20 pr-2 italic">
                حرفه‌ای‌ترین کالکشن‌های 2026
              </p>
            </div>

            <div className="hidden md:flex items-center">
              <div className="flex bg-white/80 backdrop-blur-md shadow-lg shadow-black/5 rounded-[12px] p-1 border border-white/50">
                <button className="series-prev-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[8px]">
                  <FiArrowRight size={18} />
                </button>
                <div className="w-[1px] h-5 bg-gray-100 self-center mx-1"></div>
                <button className="series-next-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[8px]">
                  <FiArrowLeft size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="relative w-full">
            <GrungeFilter />
            <Swiper
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
              breakpoints={sliderBreakpoints}
            >
              {series.map((serie, index) => (
                <SwiperSlide key={serie._id || index} className="h-auto pb-6">
                  <div className="h-full">
                    <SerieCard
                      serie={serie}
                      sportSlug={sportSlug}
                      limited={true}
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <div className="flex flex-row items-center justify-between gap-4 mt-4">
            <div className="series-pagination !w-auto flex gap-1.5"></div>
            <Link
              href={`/${sportSlug}/series`}
              className="group flex items-center gap-2 bg-white px-4 py-2 md:px-5 md:py-2.5 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 justify-center"
            >
              مشاهده همه سری‌ها
              <span className="group-hover:-translate-x-1 transition-transform duration-300">
                <FiChevronLeft className="text-base md:text-lg" />
              </span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─────────────────────────────────────────────
  // Regular Series Layout
  // ─────────────────────────────────────────────
  return (
    <section className="py-10 px-4 lg:px-8 md:py-16 bg-[#fcfcfc] relative overflow-hidden group/section">
      <div className="absolute top-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />

      <div className="absolute top-6 left-6 text-[5rem] md:text-[10rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        SERIES
      </div>

      <div className="w-full relative z-10">
        <div className="relative flex flex-row items-end justify-between mb-8 md:mb-12">
          <div className="relative">
            <h2 className="text-xl md:text-3xl font-black text-gray-900 leading-tight">
              <span className="text-[#aa4725]">سری‌های </span> {sportTitle}
            </h2>
            <p className="text-gray-400 mt-1 md:mt-2 text-xs md:text-sm font-light max-w-md border-r-2 border-[#aa4725]/20 pr-2 italic">
              حرفه‌ای‌ترین کالکشن‌های 2026
            </p>
          </div>

          <div className="hidden md:flex items-center">
            <div className="flex bg-white/80 backdrop-blur-md shadow-lg shadow-black/5 rounded-[12px] p-1 border border-white/50">
              <button className="series-prev-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[8px]">
                <FiArrowRight size={18} />
              </button>
              <div className="w-[1px] h-5 bg-gray-100 self-center mx-1"></div>
              <button className="series-next-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[8px]">
                <FiArrowLeft size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative w-full">
          <GrungeFilter />
          <Swiper
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
            breakpoints={sliderBreakpoints}
          >
            {series.map((serie, index) => (
              <SwiperSlide key={serie._id || index} className="h-auto pb-6">
                <div className="h-full">
                  <SerieCard
                    serie={serie}
                    sportSlug={sportSlug}
                    limited={false}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 mt-4">
          <div className="series-pagination !w-auto flex gap-1.5"></div>
          <Link
            href={`/${sportSlug}/series`}
            className="group flex items-center gap-2 bg-white px-4 py-2 md:px-5 md:py-2.5 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 justify-center"
          >
            مشاهده همه سری‌ها
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <FiChevronLeft className="text-base md:text-lg" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}