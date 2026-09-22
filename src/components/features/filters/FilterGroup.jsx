"use client";

import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";

/**
 * گروهِ فیلترِ چک‌باکسی (ورزش / نوع محصول / برند / سری) — کامپوننتِ مشترکِ
 * سایدبارِ صفحه‌ی ورزش و سایدبارهای صفحه‌ی سری.
 *
 * وضعیت: filters[type] یک آرایه از idهای رشته‌ای است و setFilters کلِ شیِ بعدی
 * را می‌گیرد (همان قراردادِ FilterSidebar).
 */
const getFilterItemIcon = (item, type) => {
  if (!item || typeof item !== "object") return "";

  if (type === "brands") {
    return item.icon || item.logo || item.monochromeLogo || item.image || "";
  }

  return item.icon || item.image || "";
};

export default function FilterGroup({ title, items, type, filters, setFilters }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasIcons = items.some((item) => getFilterItemIcon(item, type));

  const toggleItem = (id) => {
    // تبدیل ID به رشته برای اطمینان از مقایسه درست
    const stringId = id.toString();
    const currentItems = filters[type] || [];

    const isAlreadySelected = currentItems.includes(stringId);

    const nextItems = isAlreadySelected
      ? currentItems.filter((i) => i !== stringId) // حذف اگر قبلاً بود
      : [...currentItems, stringId]; // اضافه کردن اگر نبود

    setFilters({
      ...filters,
      [type]: nextItems,
    });
  };

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a]">{title}</span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-3 max-h-52 overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            // استخراج ID به صورت رشته
            const id = (item._id || item).toString();
            const label = item.title || item.name || item;
            const iconSrc = getFilterItemIcon(item, type);
            const isActive = filters[type]?.includes(id);
            // عمق سلسله‌مراتب (فیلتر سری): زیرسری‌ها تورفته و با خطِ اتصال زیر
            // والدشان نمایش داده می‌شوند؛ برای بقیه‌ی فیلترها همیشه ۰ است.
            const depth = item._depth || 0;

            return (
              <button
                type="button"
                key={id}
                onClick={() => toggleItem(id)}
                className={`w-full flex items-center justify-between group cursor-pointer text-right ${
                  depth > 0 ? "border-r-2 border-gray-100 pr-3" : ""
                }`}
                style={
                  depth > 0
                    ? {
                        marginRight: `${(depth - 1) * 14 + 8}px`,
                        width: `calc(100% - ${(depth - 1) * 14 + 8}px)`,
                      }
                    : undefined
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-all 
                      ${isActive ? "bg-[#aa4725] border-[#aa4725]" : "border-gray-200 group-hover:border-[#aa4725]"}`}
                  >
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                    )}
                  </div>
                  {hasIcons && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-gray-100 bg-gray-50">
                      {iconSrc && (
                        <img
                          src={iconSrc}
                          alt={label}
                          className="h-5 w-5 object-contain"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </span>
                  )}
                  <span
                    className={`min-w-0 truncate transition-colors ${
                      depth > 0 ? "text-[11px] font-medium" : "text-xs font-bold"
                    } ${
                      isActive
                        ? "text-[#aa4725]"
                        : depth > 0
                          ? "text-gray-400 group-hover:text-gray-700"
                          : "text-gray-500 group-hover:text-gray-800"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
