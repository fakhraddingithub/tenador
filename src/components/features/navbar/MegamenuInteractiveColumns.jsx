"use client";

/**
 * MegamenuInteractiveColumns.jsx
 *
 * ستون‌های ۲ (درختِ دسته‌بندی‌ها — تک‌ستونی) و ۳/۴ (نوارِ فیلترِ ویژگی + گریدِ برندها)
 * مگامنو. این کامپوننتِ کلاینتِ ایزوله، state تعاملیِ «مقدارِ فیلتر» و «دسته‌ی هاورشده»
 * را نگه می‌دارد تا Navbar/مگامنوی والد سبک بماند (Performance Shield).
 *
 * انتخابِ دسته با هاور انجام می‌شود: با هاور روی هر دسته، آن دسته فعال شده و برندهایش
 * نمایش داده می‌شوند؛ اگر دسته زیردسته داشته باشد، زیردسته‌ها با هاور به‌نرمی باز می‌شوند.
 * کلیک روی دسته به صفحه‌ی همان دسته می‌رود.
 *
 * فیلترِ پویا: هر دسته می‌تواند یک «ویژگیِ فیلترِ مگامنو» داشته باشد (category.megaMenuFilter).
 * مقادیرِ آن ویژگی به‌صورتِ تب نمایش داده می‌شوند و با انتخابِ هر مقدار، فقط برندهایی که
 * در آن دسته دستِ‌کم یک محصول با آن مقدار دارند نشان داده می‌شوند. این داده را
 * navbarService از قبل می‌سازد (category.megaMenuFilter + brand.filterValues).
 *
 * موتورِ وراثتِ URL: اگر مقداری فعال باشد، پارامترِ ?[attrName]=<value> به لینک‌ها افزوده می‌شود.
 *
 * مسیرِ لینک‌ها (مطابقِ الگوهای مجازِ resolver):
 *   - دسته:  /[sport]/[category]
 *   - برند:  /[sport]/[category]/[brand]        (الگوی ۵ — با کانتکستِ دسته)
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
  group w-full flex items-center gap-3 px-4 py-2.5 rounded-[6px] transition-all text-[15px] font-medium
  ${
    isActive
      ? "bg-[#ffffff1a] text-[#aa4725]"
      : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[#aa4725]"
  }
`;

// استایلِ «والدِ دسته» در ستونِ دو-ستونی — مثلِ listButtonStyle ولی با فاصله/پدینگِ
// فشرده‌تر و whitespace-nowrap تا نامِ دسته در دو خط نشکند (اندازه‌ی فونت بدون تغییر).
const categoryButtonStyle = (isActive) => `
  group w-full flex items-center gap-1.5 px-2 py-2.5 rounded-[6px] transition-all text-[15px] font-medium whitespace-nowrap
  ${
    isActive
      ? "bg-[#ffffff1a] text-[#aa4725]"
      : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[#aa4725]"
  }
`;

// استایلِ «فرزند» (زیردسته): کوچک‌تر، کم‌رنگ، با تورفتگیِ راست (RTL) — فشرده + بدونِ شکستِ خط
const childButtonStyle = (isActive) => `
  group w-full flex items-center gap-1.5 pr-5 pl-2 py-1.5 rounded-[6px] transition-all text-xs font-medium whitespace-nowrap
  border-r border-white/10 mr-2
  ${
    isActive
      ? "bg-[#ffffff14] text-[#aa4725]"
      : "text-gray-400/80 hover:bg-[#ffffff14] hover:text-[#aa4725]"
  }
`;

export default function MegamenuInteractiveColumns({ sport, onClose }) {
  // مقدارِ فعالِ فیلتر — پیش‌فرض null؛ کلیکِ دوباره روی همان تب آن را خاموش می‌کند
  const [activeFilterValue, setActiveFilterValue] = useState(null);
  // دسته‌ی هاورشده که ستون‌های ۳/۴ را هدایت می‌کند
  const [hoveredCatId, setHoveredCatId] = useState(null);

  const toggleFilterValue = (v) =>
    setActiveFilterValue((prev) => (prev === v ? null : v));

  const sportSlug = sport?.slug;
  const categories = sport?.categories || [];

  // ── درختِ دسته‌بندی‌ها: والدها + فرزندان (بر اساس فیلدِ parent) ──
  const idSet = new Set(categories.map((c) => c._id));
  // ریشه = بدونِ parent، یا parentی که در همین لیست نیست (یتیم → ریشه نمایش داده شود)
  const rootCategories = categories.filter(
    (c) => !c.parent || !idSet.has(c.parent),
  );
  const childrenOf = (id) =>
    categories.filter((c) => c.parent && c.parent === id);

  // ── دسته‌ی فعال (هاور): اگر هاورشده معتبر نباشد، اولین دسته تا ستون B خالی نماند ──
  // (با تعویضِ ورزش، hoveredCatId قدیمی نامعتبر می‌شود و این fallback اولین دسته را می‌گیرد)
  const effectiveCatId = categories.some((c) => c._id === hoveredCatId)
    ? hoveredCatId
    : rootCategories[0]?._id || null;
  const activeCategory =
    categories.find((c) => c._id === effectiveCatId) || null;

  // ── فیلترِ ویژگیِ دسته‌ی فعال (پویا) ──
  const megaMenuFilter = activeCategory?.megaMenuFilter || null;
  // مقدارِ اعمال‌شده فقط وقتی معتبر است که جزوِ مقادیرِ همین دسته باشد؛ با تعویضِ دسته
  // مقدارِ کهنه نادیده گرفته می‌شود (بدونِ نیاز به effect/ریست).
  const appliedValue =
    megaMenuFilter && (megaMenuFilter.values || []).includes(activeFilterValue)
      ? activeFilterValue
      : null;

  // موتورِ وراثتِ URL — اگر مقداری فعال باشد ?[attrName]=<value> افزوده می‌شود
  const withFilter = (href) =>
    appliedValue
      ? `${href}?${encodeURIComponent(megaMenuFilter.name)}=${encodeURIComponent(appliedValue)}`
      : href;

  // ── برندهای همین دسته (رابطه از روی محصول)، فیلترشده با مقدارِ فعال ──
  const categoryBrands = activeCategory?.brands || [];
  const visibleBrands = appliedValue
    ? categoryBrands.filter((b) =>
        (b.filterValues || []).includes(appliedValue),
      )
    : categoryBrands;

  return (
    <>
      {/* ستون دوم: درختِ دسته‌بندی‌ها (والد/فرزند) — هاور، ستون‌های ۳/۴ را تعیین می‌کند */}
      <div className="w-[35%] border-l border-white/[0.06] p-3 overflow-y-auto">
        <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
          دسته‌بندی‌ها
        </p>
        {rootCategories.length > 0 ? (
          // تک‌ستونی: هر «والد + زیردسته‌هایش» یک <li> با scopeِ هاورِ نام‌گذاری‌شده
          // (group/cat) است تا با هاورِ والد، زیردسته‌ها به‌نرمی باز شوند.
          <ul className="space-y-1">
            {rootCategories.map((cat) => {
              const kids = childrenOf(cat._id);
              return (
                <li key={cat._id} className="group/cat">
                  {/* والد — هاور دسته را فعال می‌کند (برندها)، کلیک به صفحه‌ی دسته می‌رود */}
                  <Link
                    href={withFilter(`/${sportSlug}/${cat.slug}`)}
                    prefetch
                    onMouseEnter={() => setHoveredCatId(cat._id)}
                    onClick={onClose}
                    className={categoryButtonStyle(effectiveCatId === cat._id)}
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

                  {/* زیردسته‌ها — به‌صورت پیش‌فرض پنهان؛ با هاورِ والد به‌نرمی باز می‌شوند */}
                  {kids.length > 0 && (
                    <div className="grid grid-rows-[0fr] group-hover/cat:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                      <div className="overflow-hidden">
                        <ul className="mt-0.5 space-y-0.5">
                          {kids.map((child) => (
                            <li key={child._id}>
                              <Link
                                href={withFilter(`/${sportSlug}/${child.slug}`)}
                                prefetch
                                onMouseEnter={() => setHoveredCatId(child._id)}
                                onClick={onClose}
                                className={childButtonStyle(
                                  effectiveCatId === child._id,
                                )}
                              >
                                <span className="flex-grow text-right">
                                  {child.title}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
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

      {/* ستون‌های سوم و چهارم: نوار فیلترِ ویژگی + گرید برندهای دسته‌ی فعال */}
      <div className="flex-1 p-3 overflow-y-auto bg-white/[0.01]">
        {/* نوار فیلترِ ویژگی — فقط اگر دسته‌ی فعال یک ویژگیِ فیلتر داشته باشد */}
        {megaMenuFilter && megaMenuFilter.values.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-4 px-1">
            <span className="text-[11px] font-bold text-gray-500 ml-1">
              {megaMenuFilter.label}:
            </span>
            {megaMenuFilter.values.map((value) => {
              const isActive = appliedValue === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleFilterValue(value)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#aa4725] text-white"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-[#aa4725]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        )}

        {/* گریدِ ۲‌ستونیِ برندهای دسته‌ی فعال */}
        {activeCategory && visibleBrands.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {visibleBrands.map((brand) => (
              <div key={brand._id} className="min-w-0">
                {/* برند = والد → /[sport]/[category]/[brand] (الگوی ۵) */}
                <Link
                  href={withFilter(
                    `/${sportSlug}/${activeCategory.slug}/${brand.slug}`,
                  )}
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
