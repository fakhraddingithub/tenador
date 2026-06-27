"use client";

/**
 * GenderFilterCard.jsx
 *
 * بلوکِ فیلترِ جنسیت برای سایدبارِ صفحاتِ برند/سری (نمای گروه‌بندی‌شده).
 * خودکفاست: مقدارِ اولیه از prop (که سرور از ?gender خوانده) می‌آید و تغییر با
 * router.push (navigationِ نرم، بدونِ رفرشِ کامل) همگام می‌شود. انتخابِ دوباره‌ی
 * همان گزینه آن را خاموش می‌کند.
 */

import { useRouter } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";
import { useState } from "react";

const OPTIONS = [
  { value: "men", label: "مردانه" },
  { value: "women", label: "زنانه" },
  { value: "kids", label: "بچگانه" },
];

export default function GenderFilterCard({ activeGender = null }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const change = (g) => {
    if (typeof window === "undefined") return;
    const next = activeGender === g ? null : g;
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("gender", next);
    else params.delete("gender");
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
        <span className="text-sm font-bold text-[#1a1a1a]">جنسیت</span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-3">
          {OPTIONS.map((opt) => {
            const isActive = activeGender === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => change(opt.value)}
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
                    {opt.label}
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
