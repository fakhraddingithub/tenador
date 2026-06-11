"use client";

/**
 * src/components/templates/sports/CollaborationsStrip.jsx
 *
 * نوار همکاری‌ها در صفحه سری — همکاری‌هایی (مثل Roland Garros) که در بین
 * محصولات این صفحه وجود دارند را به‌صورت کارت نمایش می‌دهد. کلیک روی هر
 * کارت به صفحه همان همکاری (همه محصولات آن در همه سری‌ها) می‌رود.
 */

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export default function CollaborationsStrip({ collaborations = [], sportSlug }) {
  if (!collaborations?.length) return null;

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-10">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg md:text-2xl font-black text-gray-900">
          <span className="text-[#aa4725]">همکاری‌های</span> این سری
        </h2>
        <div className="flex-1 h-[1px] bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collaborations.map((collab) => {
          const primary = collab.colors?.primary || "#0d0d0d";
          const secondary = collab.colors?.secondary || "#aa4725";

          return (
            <Link
              key={collab._id}
              href={`/${sportSlug}/${collab.slug}`}
              className="group relative overflow-hidden rounded-[14px] border border-gray-100 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* پس‌زمینه رنگی همکاری */}
              <div
                className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)`,
                }}
              />

              {/* تصویر هدر/اصلی به‌عنوان بک‌گراند محو */}
              {(collab.headImage || collab.image) && (
                <img
                  src={collab.headImage || collab.image}
                  alt={collab.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-500"
                />
              )}

              <div className="relative z-10 flex items-center gap-4 p-5 min-h-[96px]">
                {collab.logo && (
                  <img
                    src={collab.logo}
                    alt={collab.title}
                    className="h-10 md:h-12 w-auto object-contain flex-shrink-0"
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <h3
                    className="text-white font-black text-base md:text-lg truncate"
                    style={{ textShadow: "0 2px 6px rgba(0,0,0,.45)" }}
                  >
                    {collab.title}
                  </h3>
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest truncate">
                    {collab.name}
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
