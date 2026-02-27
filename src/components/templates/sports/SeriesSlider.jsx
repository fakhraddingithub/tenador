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
function SerieCard({ serie, sportSlug, index }) {
  const [hovered, setHovered] = useState(false);

  const primary   = serie.colors?.primary   || "#c0392b";
  const secondary = serie.colors?.secondary || primary;
  const rgb       = hexToRgb(primary);
  const dark      = darken(rgb, 70);
  const mid       = darken(rgb, 30);
  const bright    = lighten(rgb, 50);
  const words     = splitName(serie.name);

  const gradient = `
    radial-gradient(ellipse at 70% 20%, ${bright} 0%, transparent 55%),
    linear-gradient(160deg, ${mid} 0%, ${primary} 40%, ${dark} 100%)
  `;

  return (
    <Link
      href={`/${sportSlug}/series/${serie.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-shrink-0 w-[200px] sm:w-[240px] md:w-[275px] rounded-[20px] overflow-hidden cursor-pointer select-none"
      style={{
        aspectRatio: "3/4",
        background:  gradient,
        boxShadow:   hovered
          ? `0 24px 50px -8px ${primary}80, 0 0 0 1px ${primary}40`
          : `0 8px 30px -6px ${primary}50`,
        transform:   hovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
        transition:  "transform 0.4s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease",
      }}
    >
      {/* ── نویز texture overlay ── */}
      <div
        className="absolute inset-0 z-[1] opacity-[0.08] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── خطوط دیاگونال دکوراتیو ── */}
      <div
        className="absolute inset-0 z-[1] opacity-10 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 12px,
            rgba(255,255,255,0.15) 12px,
            rgba(255,255,255,0.15) 13px
          )`,
        }}
      />

      {/* ── هاله نورانی گوشه بالا راست ── */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none z-[2]"
        style={{
          background: `radial-gradient(circle, ${bright}90 0%, transparent 70%)`,
          transform: hovered ? "scale(1.4)" : "scale(1)",
          transition: "transform 0.5s ease",
        }}
      />

      {/* ── لوگوی برند ── */}
      {serie.brand?.logo && (
        <div className="absolute top-4 right-4 z-20">
          <img
            src={serie.brand.logo}
            alt={serie.brand.title}
            className="h-8 sm:h-9 w-auto object-contain drop-shadow-2xl"
            style={{
              filter: "brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
            }}
          />
        </div>
      )}

      {/* ── شماره / index دکوراتیو ── */}
      <div
        className="absolute top-4 left-4 z-20 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
      >
        <span className="text-white/70 text-[10px] font-black">{String(index + 1).padStart(2, "0")}</span>
      </div>

      {/* ── تصویر محصول ── */}
      {serie.coverImage && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center">
          <img
            src={serie.coverImage}
            alt={serie.name}
            className="w-[80%] h-[65%] object-contain transition-all duration-500"
            style={{
              transform:  hovered ? "scale(1.1) translateY(-4px)" : "scale(1) translateY(0)",
              filter:     "drop-shadow(0 20px 30px rgba(0,0,0,0.5))",
            }}
          />
        </div>
      )}

      {/* ── گرادینت پایین ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[55%] z-[4] pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${dark}f0 0%, ${dark}90 40%, transparent 100%)`,
        }}
      />

      {/* ── متن بزرگ وسط ── */}
      <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center pb-14 pointer-events-none">
        {words.map((word, i) => (
          <span
            key={i}
            className="text-white font-black leading-[0.85] select-none"
            style={{
              fontSize:      "clamp(1.6rem, 4.5vw, 2.6rem)",
              letterSpacing: "0.04em",
              textShadow:    "0 2px 0 rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.2)",
              opacity:       0.92,
            }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* ── پایین کارت ── */}
      <div className="absolute bottom-0 left-0 right-0 z-[6] px-4 py-4">
        {/* عنوان فارسی */}
        <p
          className="text-white font-bold text-sm truncate mb-1"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
        >
          {serie.title}
        </p>

        {/* ردیف پایین: تعداد محصول + آیکون */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}
          >
            {serie.productCount} محصول
          </span>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: hovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
              color:      hovered ? primary : "white",
            }}
          >
            <FiArrowLeft size={13} />
          </div>
        </div>
      </div>
    </Link>
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