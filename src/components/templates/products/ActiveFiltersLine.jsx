"use client";

import { useState, useEffect } from "react";

/**
 * خطِ «فیلترهای فعال» زیرِ عنوانِ هدرِ صفحه‌ی محصولات.
 * فیلترها را از query params می‌خواند (همان پارامترهایی که سیستم فیلترِ ویژگی
 * می‌نویسد) و به‌صورت «برچسبِ فارسی: مقدار» با فونت ریز نمایش می‌دهد.
 *
 * چون به‌روزرسانیِ URL با history.replaceState انجام می‌شود (که useSearchParams
 * را به‌روز نمی‌کند)، علاوه بر mount، به رویداد سفارشیِ products:filters-change
 * و popstate هم گوش می‌دهیم تا خط همگام بماند. اگر فیلتری فعال نباشد، چیزی
 * رندر نمی‌شود.
 */
export default function ActiveFiltersLine({ filterableAttributes = [] }) {
  const [pairs, setPairs] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const compute = () => {
      const sp = new URLSearchParams(window.location.search);
      const out = [];
      for (const attr of filterableAttributes) {
        const label = attr.label || attr.name;
        for (const value of sp.getAll(attr.name).filter(Boolean)) {
          out.push({ label, value });
        }
      }
      setPairs(out);
    };

    compute();
    window.addEventListener("products:filters-change", compute);
    window.addEventListener("popstate", compute);
    return () => {
      window.removeEventListener("products:filters-change", compute);
      window.removeEventListener("popstate", compute);
    };
  }, [filterableAttributes]);

  if (pairs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-white/90 drop-shadow">
      {pairs.map((p, i) => (
        <span key={`${p.label}-${p.value}-${i}`} className="flex items-center gap-2">
          <span>
            {p.label}: <span className="font-bold">{p.value}</span>
          </span>
          {i < pairs.length - 1 && (
            <span className="text-white/40">|</span>
          )}
        </span>
      ))}
    </div>
  );
}
