"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight, FiArrowLeft } from "react-icons/fi";

/* ── رنگ رو کمی روشن‌تر/تیره‌تر کن برای گرادینت ── */
function hexToRgb(hex = "#888") {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
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
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" result="noise" />
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
        className="relative flex-shrink-0 w-[240px] sm:w-[280px] md:w-[310px] rounded-[24px] overflow-hidden cursor-pointer select-none shadow-2xl"
        style={{
          aspectRatio: "2.8/4",
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
        {serie.coverImage && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center">
            <img
              src={serie.coverImage}
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
                textShadow: "0 8px 0 rgba(0, 0, 0, 0.8), 0 3px 2px rgba(0, 0, 0, 0.6)",
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
          <h3 className="text-white font-black text-base"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
            {serie.title}
          </h3>
        </div>
      </Link>
    </>
  );
}

/* ─────────────────────────── SeriesSlider ─────────────────────────── */
export default function SeriesSlider({ series, sportSlug, sportTitle }) {
  const scrollRef  = useRef(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(series?.length > 3);

  if (!series?.length) return null;

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({
      left:     dir === "right" ? -300 : 300,
      behavior: "smooth",
    });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  return (
    <section className="py-12 md:py-20 overflow-hidden" dir="rtl">

      {/* ── هدر ── */}
      <div className="flex items-end justify-between px-4 lg:px-8 mb-8 max-w-[1440px] mx-auto">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-[var(--color-primary)] uppercase mb-2 opacity-70">
            مجموعه‌های ویژه
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-[var(--color-text)] leading-tight">
            سری‌های {sportTitle}
          </h2>
        </div>
        <Link
          href={`/${sportSlug}/series`}
          className="group flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:gap-2.5 transition-all duration-300"
        >
          همه سری‌ها
          <span className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-white transition-all">
            <FiChevronLeft size={14} />
          </span>
        </Link>
      </div>

      {/* ── اسلایدر ── */}
      <div className="relative px-4 lg:px-8 max-w-[1440px] mx-auto">

        {/* دکمه‌های ناوبری */}
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-11 h-11 bg-white shadow-xl rounded-full flex items-center justify-center hover:scale-110 transition-all border border-gray-100"
          >
            <FiChevronLeft size={18} className="text-gray-700" />
          </button>
        )}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-11 h-11 bg-white shadow-xl rounded-full flex items-center justify-center hover:scale-110 transition-all border border-gray-100"
          >
            <FiChevronRight size={18} className="text-gray-700" />
          </button>
        )}

        {/* محفظه اسکرول */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-4 overflow-x-auto pb-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {series.map((serie, i) => (
            <SerieCard
              key={serie._id}
              serie={serie}
              sportSlug={sportSlug}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}