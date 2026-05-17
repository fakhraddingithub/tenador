"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  FiChevronLeft,
  FiChevronRight,
  FiArrowLeft,
  FiArrowRight,
  FiLayers,
} from "react-icons/fi";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

/* ── رنگ رو کمی روشن‌تر/تیره‌تر کن برای گرادینت ── */
function hexToRgb(hex = "#888") {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function darken({ r, g, b }, amount = 60) {
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

function lighten({ r, g, b }, amount = 40) {
  return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
}

/* ── اسم انگلیسی رو کلمه‌ای جدا کن ── */
function splitName(name = "") {
  return name.trim().toUpperCase().split(/\s+/);
}

/* ─────────────────────────── SerieCard ─────────────────────────── */
/* ── SVG Filter برای افکت نویز روی متن (این را خارج از کامپوننت بگذار) ── */
/* ── SVG Filter با نویز شدیدتر ── */
const GrungeFilter = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }}>
    <filter id="visage-grunge-heavy">
      {/* افزایش baseFrequency نویز را ریزتر و شدیدتر می‌کند */}
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

function SerieCard({ serie, sportSlug, index }) {
  const [hovered, setHovered] = useState(false);

  const primary = serie.colors?.primary || "#c0392b";
  const secondary = serie.colors?.secondary || "#e74c3c";
  const words = splitName(serie.name);

  // گرادینت از پایین (Primary) به بالا (Secondary)
  const gradient = `linear-gradient(to top, ${primary} 0%, ${secondary} 100%)`;

  return (
    <>
      <GrungeFilter />
      <Link
        href={`/${sportSlug}/series/${serie.slug}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex-shrink-0 w-full rounded-[24px] overflow-hidden cursor-pointer select-none shadow-2xl aspect-[2.8/4]"
        style={{
          background: gradient,
        }}
      >
        {/* ── لوگوی سری (بالا چپ - سفید شده) ── */}
        {serie.logo && (
          <div className="absolute top-1 left-6 z-40">
            <img
              src={serie.logo}
              alt="logo"
              className="h-15 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        )}

        {/* ── تصویر محصول (بسیار بزرگ - ۹۰٪ کارت) ── */}
        {serie.image && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center">
            <img
              src={serie.image}
              alt={serie.name}
              className="w-[100%] h-[100%] object-contain transition-transform duration-500"
              style={{
                transform: hovered ? "scale(1.1)" : "scale(1)",
                filter: "drop-shadow(0 15px 35px rgba(0,0,0,0.3))",
              }}
            />
          </div>
        )}

        {/* ── متن نویزی (روی عکس قرار گرفته - zIndex 20) ── */}
        <div className="absolute inset-0 z-[20] flex flex-col items-center justify-center pointer-events-none">
          {words.map((word, i) => (
            <span
              key={i}
              className="text-white leading-[0.8] text-center uppercase"
              style={{
                fontSize: "2.8rem",
                fontWeight: "1000",
                WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.5)",
                textShadow:
                  "0 8px 0 rgba(0, 0, 0, 0.8), 0 3px 2px rgba(0, 0, 0, 0.6)",
                filter: "url(#visage-grunge-heavy)",
                opacity: 0.9,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* ── عنوان فارسی (پایین سمت راست) ── */}
        <div className="absolute bottom-6 right-6 z-30 text-right">
          <h3
            className="text-white font-black text-base"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}
          >
            {serie.title}
          </h3>
        </div>
      </Link>
    </>
  );
}

/* ─────────────────────────── SeriesSlider ─────────────────────────── */

export default function SeriesSlider({ series = [], sportSlug, sportTitle }) {
  if (!series?.length) return null;

  return (
    <section className="py-12 md:py-24 bg-[#fcfcfc] relative overflow-hidden group/section">
      {/* ───────────────── Background ───────────────── */}
      <div className="absolute top-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />

      <div className="absolute top-12 left-6 text-[8rem] md:text-[15rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        SERIES
      </div>

      <div className="container mx-auto px-4 md:px-16 lg:px-24 xl:px-40 relative z-10">
        {/* ───────────────── Header ───────────────── */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-[#aa4725]/10 flex items-center justify-center">
                <FiLayers className="text-[#aa4725]" size={18} />
              </div>

              <p className="text-xs font-black tracking-[0.25em] text-[#aa4725] uppercase opacity-70">
                مجموعه‌های ویژه
              </p>
            </div>

            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              سری‌های <span className="text-[#aa4725]">{sportTitle}</span>
            </h2>

            <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
              حرفه‌ای‌ترین کالکشن‌های مرتبط با {sportTitle}
            </p>
          </div>

          {/* navigation */}
          <div className="hidden md:flex items-center mt-8 md:mt-0">
            <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-[16px] p-1 border border-white/50">
              <button className="series-prev-btn w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowRight size={22} />
              </button>

              <div className="w-[1px] h-6 bg-gray-100 self-center mx-1"></div>

              <button className="series-next-btn w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowLeft size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* ───────────────── Slider ───────────────── */}
        <div className="relative overflow-hidden">
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={12}
            slidesPerView={1.2}
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
            breakpoints={{
              480: {
                slidesPerView: 1.5,
                spaceBetween: 14,
              },

              640: {
                slidesPerView: 2,
                spaceBetween: 16,
              },

              768: {
                slidesPerView: 2.5,
                spaceBetween: 18,
              },

              1024: {
                slidesPerView: 3,
                spaceBetween: 20,
              },

              1280: {
                slidesPerView: 3.5,
                spaceBetween: 24,
              },
            }}
          >
            {series.map((serie, index) => (
              <SwiperSlide key={serie._id || index} className="h-auto pb-10">
                <div className="h-full hover:-translate-y-1.5 transition-transform duration-500">
                  <SerieCard
                    serie={serie}
                    sportSlug={sportSlug}
                    index={index}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* ───────────────── Footer ───────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6">
          <div className="series-pagination !w-auto flex gap-2"></div>

          <Link
            href={`/${sportSlug}/series`}
            className="group flex items-center gap-2 bg-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 w-full sm:w-auto justify-center"
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
