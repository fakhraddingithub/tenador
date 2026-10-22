"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { withQueryParams } from "@/lib/navbarAudience";
import {
  FiChevronLeft,
  FiPlusCircle,
} from "react-icons/fi";
import useDragClickGuard from "@/hooks/useDragClickGuard";
import SliderShowcase, { ShowcaseTitle } from "./SliderShowcase";

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

function SerieCard({ serie, sportSlug, targetAudience, limited = false }) {
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
    <Link href={withQueryParams(`/${sportSlug}/${serie.brand.slug}/${serie.slug}`, { targetAudience })} className="block w-full">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          relative
          flex-shrink-0
          w-full
          rounded-[14px]
          overflow-hidden
          cursor-pointer
          select-none
          ${limited ? "aspect-[3.3/4]" : "aspect-[2.8/4]"}
          transition-shadow
          duration-500
         
        `}
        style={{
          background: gradient,
        }}
      >
        {/* گرادینت تاریک روی تصویر فقط برای لیمیتد */}
        {limited && (
          <div
            className="absolute inset-0 z-[15] pointer-events-none"
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

        {/* لوگو - هماهنگ شده با سایز موبایل */}
        {(serie.logo || serie.brand?.monochromeLogo || serie.brand?.logo) && (
          <div className="absolute top-3 left-4 md:top-4 md:left-5 z-40">
            <img
              src={serie.logo || serie.brand?.monochromeLogo || serie.brand?.logo}
              alt={serie.title || serie.brand?.title || "logo"}
              className="h-[32px] sm:h-[40px] md:h-[55px] w-auto object-contain transition-transform duration-500"
              style={{
                filter: "brightness(0) invert(1)",
                transform: hovered && limited ? "scale(1.05)" : "scale(1)",
              }}
            />
          </div>
        )}

        {/* تصویر - محصور شده در کادر با زوم واقعی و بدون بیرون زدگی */}
        {serie.image && (
          <div className="absolute inset-0 z-[20] flex items-center justify-center pointer-events-none">
            <img
              src={serie.image}
              alt={serie.name}
              className="absolute transition-transform duration-500 ease-out"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",

                transform: hovered
                  ? limited
                    ? "scale(1.40)"
                    : "scale(1.20)"
                  : limited
                    ? "scale(1.30)"
                    : "scale(1.15)",

                filter: limited
                  ? "drop-shadow(0 20px 30px rgba(0,0,0,0.5))"
                  : "drop-shadow(0 15px 25px rgba(0,0,0,0.3))",
              }}
            />
          </div>
        )}

        {/* متن وسط کارت - بازنویسی بیس فونت‌ها برای جلوگیری از شکستگی در موبایل */}
        <div className="absolute inset-0 z-[30] flex flex-col items-center justify-center pointer-events-none px-3">
          {words.map((word, i) => (
            <span
              key={i}
              className="text-white leading-[0.82] text-center uppercase break-words w-full"
              style={{
                /* کنترل بازه سایز فونت در موبایل و دسکتاپ به کمک clamp متغیر */
                fontSize: limited
                  ? "clamp(1.2rem, 5vw, 2.6rem)"
                  : "clamp(0.95rem, 4vw, 2rem)",
                fontWeight: "900",
                WebkitTextStroke: limited
                  ? "clamp(0.8px, 0.2vw, 1.5px) rgba(0,0,0,0.6)"
                  : "clamp(0.5px, 0.1vw, 1px) rgba(0,0,0,0.4)",
                textShadow: `
                  0 clamp(4px, 1vw, 8px) 0 rgba(0, 0, 0, 0.8),
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

        {/* عنوان پایین کارت - پدینگ و سایز کاملاً پویا */}
        <div className="absolute bottom-3 right-4 left-4 md:bottom-5 md:right-5 md:left-5 z-40 text-right">
          <h3
            className={`text-white font-black truncate transition-transform duration-500 ${
              limited
                ? "text-sm sm:text-base md:text-lg"
                : "text-xs sm:text-sm md:text-base"
            }`}
            style={{
              textShadow: "0 2px 6px rgba(0,0,0,.65)",
              transform:
                hovered && limited ? "translateY(-4px)" : "translateY(0)",
            }}
          >
            {serie.brand?.title ? `${serie.brand.title} ${serie.title}` : serie.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

/**
 * heading: { highlight, title, subtitle } — عنوانِ سفارشی (بلوکِ «اسلایدر سری‌های
 *   ورزش»). بدونِ آن همان متن‌های صفحه‌ی ورزش رندر می‌شود.
 * fitContainer: نقطه‌شکن‌ها با عرضِ خودِ اسلایدر سنجیده می‌شوند نه پنجره — برای
 *   وقتی که اسلایدر داخلِ خانه‌ی باریکِ یک بلوکِ ادغام‌شده است.
 */
export default function SeriesSlider({ series = [], sportSlug, sportTitle, targetAudience, heading = null, fitContainer = false }) {
  // قبل از return زودهنگام صدا زده می‌شود تا ترتیبِ هوک‌ها ثابت بماند.
  // حرکتِ خودِ اسلایدر با Swiper است؛ این هوک فقط کلیکِ بعد از درگ را می‌بلعد.
  const sliderRef = useDragClickGuard();
  // کلاسِ یکتای دکمه‌ها برای هر اسلایدر: Swiper انتخابگرِ رشته‌ای را در کلِ سند
  // می‌جوید، پس با کلاسِ مشترک دو اسلایدرِ یک صفحه (جدید + لیمیتد، یا چند بلوک)
  // هر کدام با دکمه‌های دیگری هم جابه‌جا می‌شدند.
  const navKey = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  if (!series?.length) return null;

  const isLimitedEdition = series.every((s) => s.isLimitedEdition);

  // ─────────────────────────────────────────────
  // تنظیمات اسلایدر برای کارت‌های معمولی (۴ کارت در دسکتاپ)
  // ─────────────────────────────────────────────
  const regularBreakpoints = {
    0: { slidesPerView: 2.1, spaceBetween: 10 },
    640: { slidesPerView: 2.8, spaceBetween: 12 },
    768: { slidesPerView: 3.2, spaceBetween: 14 },
    1024: { slidesPerView: 4, spaceBetween: 16 },
    1280: { slidesPerView: 4, spaceBetween: 16 },
  };

  // ─────────────────────────────────────────────
  // تنظیمات اسلایدر برای لیمیتد ادیشن (۳ کارت در دسکتاپ)
  // ─────────────────────────────────────────────
  const limitedBreakpoints = {
    0: { slidesPerView: 2.1, spaceBetween: 14 },
    640: { slidesPerView: 2.2, spaceBetween: 16 },
    768: { slidesPerView: 2.5, spaceBetween: 16 },
    1024: { slidesPerView: 3, spaceBetween: 16 },
    1280: { slidesPerView: 3, spaceBetween: 16 },
  };

  // شرط اعمال پدینگ کانتینر
  const containerPaddingClass = isLimitedEdition
    ? "px-4 sm:px-8 md:px-16 lg:px-[90px]"
    : "px-4 sm:px-8 md:px-16 lg:px-[90px]";

  return (
    <SliderShowcase
      watermark="SERIES"
      paddingClass={containerPaddingClass}
      prevClass={`series-prev-btn series-prev-${navKey}`}
      nextClass={`series-next-btn series-next-${navKey}`}
      title={heading ? (
        <ShowcaseTitle highlight={heading.highlight} title={heading.title || sportTitle} subtitle={heading.subtitle} />
      ) : isLimitedEdition ? (
        <>
          <span className="text-[#aa4725]">سری های</span>لیمیتد ادیشن
          <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
            کمیاب کالکشن‌های 2026
          </p>
        </>
      ) : (
        <>
          <span className="text-[#aa4725]">سری‌های </span> {sportTitle}
          <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
            جدیدترین کالکشن‌های 2026
          </p>
        </>
      )}
    >
      <div className="relative w-full" ref={sliderRef}>
        <GrungeFilter />
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          breakpointsBase={fitContainer ? "container" : "window"}
          watchOverflow={true}
          centeredSlides={false}
          autoplay={{
            delay: 4500,
            disableOnInteraction: true,
          }}
          navigation={{
            nextEl: `.series-next-${navKey}`,
            prevEl: `.series-prev-${navKey}`,
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
            <SwiperSlide key={serie._id || index} className="h-auto pb-10">
              <div className="h-full">
                <SerieCard
                  serie={serie}
                  sportSlug={sportSlug}
                  targetAudience={targetAudience}
                  limited={isLimitedEdition}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* فوتر اورجینال دکمه‌های پایین — flex-row: روی موبایل هم در یک خط بمانند.
          کلاس‌ها یک‌خطی‌اند: نسخه‌ی چندخطی، توضیح‌های JSX را *داخلِ* خودِ رشته
          داشت که کلاس‌های بی‌معنا می‌ساخت و هیدریشن را ناهم‌خوان می‌کرد (سرور و
          مرورگر خطِ تازه‌ی داخلِ class را یکسان نمی‌نویسند). همان کلاس‌ها، همان ظاهر. */}
      <div className="flex flex-row items-center justify-between gap-4 mt-1 w-full">
        {/* پجینیشن اسلایدر */}
        <div className="slider-pagination-2 !w-auto flex gap-1.5 md:gap-2 flex-shrink-0"></div>

        {/* دکمه کاتالوگ — پدینگ جمع‌وجورتر و فونتِ ۱۱px در موبایل، whitespace-nowrap
            تا متن نشکند. */}
        <Link
          href="/products"
          className="group flex items-center gap-2 bg-white px-4 py-2 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-[11px] sm:text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 whitespace-nowrap"
        >
          مشاهده کاتالوگ محصولات
          <FiPlusCircle className="text-base md:text-xl group-hover:rotate-180 transition-transform duration-500 flex-shrink-0" />
        </Link>
      </div>
    </SliderShowcase>
  );
}
