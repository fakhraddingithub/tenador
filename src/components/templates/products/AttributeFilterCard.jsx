"use client";

/**
 * AttributeFilterCard.jsx
 *
 * بلوکِ فیلترِ ویژگیِ مگامنو برای سایدبارِ صفحه‌ی برند (نمای گروه‌بندی‌شده).
 * جایگزینِ GenderFilterCard است اما برای «هر ویژگی» کار می‌کند: نام و گزینه‌ها از
 * فرادادهٔ دسته می‌آیند (category.megaMenuFilterAttribute). مقدارِ اولیه از prop
 * (که سرور از ?[name] خوانده) و تغییر با router.push (navigationِ نرم) همگام می‌شود.
 * انتخابِ دوباره‌ی همان گزینه آن را خاموش می‌کند.
 *
 * meta: { name, label, options: string[] }
 */

import { useRouter } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";
import { useState } from "react";

export default function AttributeFilterCard({ meta = null, activeValue = null }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  if (!meta || !meta.name) return null;

  // گزینه‌ها: مقادیرِ تعریف‌شده‌ی ادمین؛ اگر خالی بود ولی مقداری فعال است، همان را نشان بده
  const options =
    Array.isArray(meta.options) && meta.options.length > 0
      ? meta.options.map(String)
      : activeValue
        ? [String(activeValue)]
        : [];

  if (options.length === 0) return null;

  const change = (v) => {
    if (typeof window === "undefined") return;
    const next = activeValue === v ? null : v;
    const params = new URLSearchParams(window.location.search);
    if (next) params.set(meta.name, next);
    else params.delete(meta.name);
    const qs = params.toString();
    router.push(
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      { scroll: false },
    );
  };

  return (
    <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a]">{meta.label}</span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-3">
          {options.map((opt) => {
            const isActive = String(activeValue) === opt;
            return (
              <div
                key={opt}
                onClick={() => change(opt)}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                      ${isActive ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-gray-200 group-hover:border-[var(--color-primary)]"}`}
                  >
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold transition-colors ${isActive ? "text-[var(--color-primary)]" : "text-gray-500 group-hover:text-gray-800"}`}
                  >
                    {opt}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
