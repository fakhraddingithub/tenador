"use client";

/**
 * src/components/templates/sports/LimitedEditionsStrip.jsx
 *
 * نوار لیمیتد ادیشن‌ها در صفحه سری — لیمیتد ادیشن‌هایی (مثل Roland Garros) که در بین
 * محصولات این صفحه وجود دارند را به‌صورت کارت نمایش می‌دهد. کلیک روی هر
 * کارت به صفحه همان لیمیتد ادیشن (همه محصولات آن در همه سری‌ها) می‌رود:
 * /[brandSlug]/[limitedEditionSlug] — لیمیتد ادیشن‌ها برند-محور هستند.
 */

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export default function LimitedEditionsStrip({ limitedEditions = [], brandSlug }) {
  if (!limitedEditions?.length || !brandSlug) return null;

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-10">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg md:text-2xl font-black text-gray-900">
          <span className="text-[#aa4725]">لیمیتد ادیشن‌های</span> این سری
        </h2>
        <div className="flex-1 h-[1px] bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {limitedEditions.map((le) => {
          const primary = le.colors?.primary || "#0d0d0d";
          const secondary = le.colors?.secondary || "#aa4725";

          return (
            <Link
              key={le._id}
              href={`/${brandSlug}/${le.slug}`}
              className="group relative overflow-hidden rounded-[14px] border border-gray-100 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* پس‌زمینه رنگی لیمیتد ادیشن */}
              <div
                className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)`,
                }}
              />

              {/* تصویر هدر/اصلی به‌عنوان بک‌گراند محو */}
              {(le.headImage || le.image) && (
                <img
                  src={le.headImage || le.image}
                  alt={le.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-500"
                />
              )}

              <div className="relative z-10 flex items-center gap-4 p-5 min-h-[96px]">
                {le.logo && (
                  <img
                    src={le.logo}
                    alt={le.title}
                    className="h-10 md:h-12 w-auto object-contain flex-shrink-0"
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <h3
                    className="text-white font-black text-base md:text-lg truncate"
                    style={{ textShadow: "0 2px 6px rgba(0,0,0,.45)" }}
                  >
                    {le.title}
                  </h3>
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest truncate">
                    {le.name}
                  </p>
                </div>

                <span className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#0d0d0d] transition-all flex-shrink-0">
                  <FiArrowLeft size={16} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
