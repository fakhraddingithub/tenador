"use client";

/**
 * MegamenuInteractiveColumns.jsx
 *
 * ستون‌های ۲ (درختِ دسته‌بندی‌ها) و ۳/۴ (نوارِ جنسیت + گریدِ برندها + سری‌های ریشه)
 * مگامنو. این کامپوننتِ کلاینتِ ایزوله، state تعاملیِ «جنسیت» را نگه می‌دارد تا
 * Navbar/مگامنوی والد سبک بماند (Performance Shield).
 *
 * موتورِ وراثتِ URL: اگر activeGender تنظیم باشد، به همه‌ی لینک‌های ستون‌های ۲،۳،۴
 * پارامترِ ?gender=<value> افزوده می‌شود.
 *
 * کلاس‌های موجودِ ستون‌ها/لینک‌ها عیناً از مگامنوی اصلی کپی شده‌اند (UI Shield)؛
 * فقط wrapperهای grid/flex و استایلِ «فرزند» (کوچک‌تر/کم‌رنگ/تورفته) افزوده شده‌اند.
 */

import { useState } from "react";
import Link from "next/link";
import { FiChevronLeft } from "react-icons/fi";

// آیکونِ ماسک‌شده با رنگِ متن — عیناً مثلِ مگامنوی اصلی
const iconMaskStyle = (url) => ({
  backgroundColor: "currentColor",
  maskImage: `url(${url})`,
  WebkitMaskImage: `url(${url})`,
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskSize: "contain",
  WebkitMaskSize: "contain",
});

// استایلِ دکمه‌های لیست — عیناً مثلِ مگامنوی اصلی
const listButtonStyle = (isActive) => `
  group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-[15px] font-medium
  ${
    isActive
      ? "bg-[#ffffff1a] text-[#aa4725]"
      : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[#aa4725]"
  }
`;

// استایلِ «فرزند» (زیردسته / سری ریشه): کوچک‌تر، کم‌رنگ، با تورفتگیِ راست (RTL)
const childButtonStyle = `
  group w-full flex items-center gap-2 pr-7 pl-3 py-1.5 rounded-lg transition-all text-xs font-medium
  text-gray-400/80 border-r border-white/10 mr-3
  hover:bg-[#ffffff14] hover:text-[#aa4725]
`;

const GENDER_PILLS = [
  { value: "men", label: "مردانه" },
  { value: "women", label: "زنانه" },
  { value: "kids", label: "بچگانه" },
];

export default function MegamenuInteractiveColumns({ sport, onClose }) {
  // state تعاملیِ ایزوله — پیش‌فرض null؛ کلیکِ دوباره روی همان پیل آن را خاموش می‌کند
  const [activeGender, setActiveGender] = useState(null);

  const toggleGender = (g) =>
    setActiveGender((prev) => (prev === g ? null : g));

  // موتورِ وراثتِ URL — به همه‌ی لینک‌های ستون‌های ۲/۳/۴ اعمال می‌شود
  const withGender = (href) =>
    activeGender ? `${href}?gender=${activeGender}` : href;

  const sportSlug = sport?.slug;
  const categories = sport?.categories || [];
  const allBrands = sport?.brands || [];

  // ── درختِ دسته‌بندی‌ها: والدها + فرزندان (بر اساس فیلدِ parent) ──
  const idSet = new Set(categories.map((c) => c._id));
  // ریشه = بدونِ parent، یا parentی که در همین لیست نیست (یتیم → ریشه نمایش داده شود)
  const rootCategories = categories.filter(
    (c) => !c.parent || !idSet.has(c.parent),
  );
  const childrenOf = (id) =>
    categories.filter((c) => c.parent && c.parent === id);

  // ── فیلترِ جنسیتِ برندها (Data constraint: availableGenders از سرور می‌آید) ──
  const visibleBrands = activeGender
    ? allBrands.filter((b) => (b.availableGenders || []).includes(activeGender))
    : allBrands;

  return (
    <>
      {/* ستون دوم: درختِ دسته‌بندی‌ها (والد/فرزند) */}
      <div className="w-[35%] border-l border-white/[0.06] p-3 overflow-y-auto">
        <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
          دسته‌بندی‌ها
        </p>
        {rootCategories.length > 0 ? (
          <ul className="space-y-1">
            {rootCategories.map((cat) => {
              const kids = childrenOf(cat._id);
              return (
                <li key={cat._id}>
                  {/* والد — تایپوگرافیِ موجود */}
                  <Link
                    href={withGender(`/${sportSlug}/${cat.slug}`)}
                    prefetch
                    onClick={onClose}
                    className={listButtonStyle(false)}
                  >
                    {cat.icon && (
                      <div
                        style={iconMaskStyle(cat.icon)}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="flex-grow text-right font-bold">
                      {cat.title}
                    </span>
                    <FiChevronLeft size={16} className="opacity-20" />
                  </Link>

                  {/* فرزندان — کوچک‌تر/کم‌رنگ/تورفته */}
                  {kids.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {kids.map((child) => (
                        <li key={child._id}>
                          <Link
                            href={withGender(`/${sportSlug}/${child.slug}`)}
                            prefetch
                            onClick={onClose}
                            className={childButtonStyle}
                          >
                            <span className="flex-grow text-right">
                              {child.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-gray-600 text-[13px] p-4 text-center">
            موردی یافت نشد
          </div>
        )}
      </div>

      {/* ستون‌های سوم و چهارم: نوار جنسیت + گرید برندها + سری‌های ریشه */}
      <div className="flex-1 p-3 overflow-y-auto bg-white/[0.01]">
        {/* نوار جنسیت (پیل‌ها) */}
        <div className="flex items-center gap-2 mb-4 px-1">
          {GENDER_PILLS.map((pill) => {
            const isActive = activeGender === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => toggleGender(pill.value)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#aa4725] text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-[#aa4725]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* گریدِ ۲‌ستونیِ برندها */}
        {visibleBrands.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {visibleBrands.map((brand) => (
              <div key={brand._id} className="min-w-0">
                {/* برند = والد (تایپوگرافیِ موجود) */}
                <Link
                  href={withGender(`/${sportSlug}/${brand.slug}`)}
                  prefetch
                  onClick={onClose}
                  className={listButtonStyle(false)}
                >
                  {brand.icon && (
                    <div
                      style={iconMaskStyle(brand.icon)}
                      className="w-5 h-5 shrink-0 opacity-70 group-hover:opacity-100"
                    />
                  )}
                  <span className="flex-grow text-right font-medium truncate">
                    {brand.title}
                  </span>
                </Link>

                {/* سری‌های ریشه (level 0) = فرزند — فقط در صورت وجود */}
                {brand.series?.length > 0 && (
                  <ul className="mt-0.5 mb-1 space-y-0.5">
                    {brand.series.map((serie) => (
                      <li key={serie._id}>
                        <Link
                          href={withGender(
                            `/${sportSlug}/${brand.slug}/${serie.slug}`,
                          )}
                          prefetch
                          onClick={onClose}
                          className={childButtonStyle}
                        >
                          <span className="flex-grow text-right truncate">
                            {serie.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600 text-[13px] p-4 text-center">
            برندی یافت نشد
          </div>
        )}
      </div>
    </>
  );
}
