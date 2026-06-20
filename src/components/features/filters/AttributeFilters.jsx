"use client";

import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { COLOR_PALETTE, isColorAttribute } from "@/lib/colorMatch";

/**
 * کامپوننتِ مشترکِ فیلترِ ویژگی — همه‌جای سایت از همین استفاده می‌کنند
 * (صفحهٔ محصولات، صفحهٔ ورزش، صفحه‌های دسته/اسلاگ، دست‌دوم، و انتخابِ محصولِ کمپین).
 *
 * - ویژگیِ «رنگ» → گریدِ ۴×۴ از ۱۶ سواچِ ثابت (فقط رنگ، بدون متن).
 * - بقیهٔ ویژگی‌ها → دکمه‌های هم‌اندازه که دقیقاً در ۲ ردیف چیده می‌شوند
 *   (grid-rows-2 + grid-flow-col)؛ برچسب‌های بلند با truncate + tooltip مهار می‌شوند
 *   تا اندازهٔ یکسانِ دکمه‌ها به‌هم نخورد.
 *
 * وضعیت همه‌جا { [name]: [value, ...] } است. setAttrFilters کلِ شیِ بعدی را
 * می‌گیرد (والد تصمیم می‌گیرد URL را هم به‌روز کند یا نه).
 */

const toggle = (arr, v) =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

function AttrSection({ attr, attrFilters, setAttrFilters, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const selected = attrFilters[attr.name] || [];
  const isColor = isColorAttribute(attr.name);

  const apply = (nextSel) => {
    const all = { ...attrFilters };
    if (nextSel.length) all[attr.name] = nextSel;
    else delete all[attr.name];
    setAttrFilters(all);
  };

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
          {attr.label}
          {selected.length > 0 && (
            <span className="bg-[#aa4725] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {selected.length}
            </span>
          )}
        </span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5">
          {isColor ? (
            // گریدِ ۴×۴ از سواچ‌های رنگ — فقط رنگ، بدون برچسب.
            <div className="grid grid-cols-4 grid-rows-4 gap-2.5 w-max mx-auto">
              {COLOR_PALETTE.map((c) => {
                const active = selected.includes(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={active}
                    onClick={() => apply(toggle(selected, c.name))}
                    className={`w-8 h-8 rounded-full transition-all ${
                      active
                        ? "ring-2 ring-offset-2 ring-[#aa4725] border border-white"
                        : "border border-gray-200 hover:scale-110"
                    }`}
                    style={{ background: c.hex }}
                  />
                );
              })}
            </div>
          ) : (
            // دکمه‌های هم‌اندازه در دقیقاً ۲ ردیف (با اسکرولِ افقی در صورت زیادی).
            <div className="grid grid-rows-2 grid-flow-col auto-cols-[minmax(64px,1fr)] gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {(attr.options || []).map((opt) => {
                const active = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.value}
                    aria-pressed={active}
                    onClick={() => apply(toggle(selected, opt.value))}
                    className={`h-9 px-2 rounded-[6px] text-[11px] font-bold border truncate transition-all ${
                      active
                        ? "bg-[#aa4725] border-[#aa4725] text-white"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-[#aa4725]"
                    }`}
                  >
                    {opt.value}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttributeFilters({
  attrMeta = [],
  attrFilters = {},
  setAttrFilters = () => {},
  defaultOpen = false,
}) {
  if (!attrMeta.length) return null;
  return (
    <>
      {attrMeta.map((attr) => (
        <AttrSection
          key={attr.name}
          attr={attr}
          attrFilters={attrFilters}
          setAttrFilters={setAttrFilters}
          defaultOpen={defaultOpen}
        />
      ))}
    </>
  );
}
