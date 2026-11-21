"use client";

import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { COLOR_PALETTE, isColorAttribute } from "@/lib/colorMatch";
import { isRangeSelection, toNumber } from "@/lib/attributeFilters";
import { THUMB_INPUT_CLASS } from "@/components/features/filters/PriceRangeFilter";

/**
 * کامپوننتِ مشترکِ فیلترِ ویژگی — همه‌جای سایت از همین استفاده می‌کنند
 * (صفحهٔ محصولات، صفحهٔ ورزش، صفحه‌های دسته/اسلاگ، دست دوم، و انتخابِ محصولِ کمپین).
 *
 * - ویژگیِ «رنگ» → گریدِ ۴×۴ از ۱۶ سواچِ ثابت (فقط رنگ، بدون متن)؛ تک‌انتخابی:
 *   کلیک روی رنگِ دیگر جایگزینِ قبلی می‌شود، کلیک روی رنگِ فعال لغوش می‌کند.
 * - ویژگیِ عددی (همه‌ی مقادیر عدد) → بازه با اسلایدرِ دوسَره + دو اینپوت، مثلِ قیمت.
 * - بقیهٔ ویژگی‌ها → دکمه‌های هم‌اندازه که دقیقاً در ۲ ردیف چیده می‌شوند
 *   (grid-rows-2 + grid-flow-col)؛ برچسب‌های بلند با truncate + tooltip مهار می‌شوند
 *   تا اندازهٔ یکسانِ دکمه‌ها به‌هم نخورد.
 *
 * exactValues (فرمِ قانونِ کمپین): همه‌چیز دکمه‌ی چندانتخابی می‌ماند، چون قانونِ
 * ذخیره‌شده آرایه‌ی مقادیرِ دقیق است (resolveAttributeRule).
 *
 * وضعیت { [name]: [value, ...] } و برای بازه { [name]: { min, max } } است.
 * setAttrFilters کلِ شیِ بعدی را می‌گیرد (والد تصمیم می‌گیرد URL را هم به‌روز کند یا نه).
 */

const toggle = (arr, v) =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fmt = (n) => Number(n).toLocaleString("fa-IR", { maximumFractionDigits: 6 });

// اینپوتِ یک سرِ بازه: حینِ تایپ متنِ خودش را نگه می‌دارد و فقط با blur/Enter
// ثبت می‌کند، تا «۲۱.» وسطِ تایپ به ۲۱ تبدیل نشود. خالی = بدونِ کف/سقف.
function BoundInput({ value, placeholder, label, onCommit }) {
  const [text, setText] = useState(null); // null = در حالِ ویرایش نیست
  const commit = () => {
    if (text === null) return;
    const s = text.replace(/[,،٬\s]/g, "");
    onCommit(s === "" ? null : toNumber(s) ?? value);
    setText(null);
  };
  return (
    <input
      type="text"
      dir="ltr"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      value={text ?? (value == null ? "" : String(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 text-center focus:border-[var(--color-primary,#aa4725)] outline-none font-bold"
    />
  );
}

/**
 * بازه‌ی عددی — همان رفتارِ PriceRangeFilter، با دامنه‌ی واقعیِ مقادیر (نه از صفر)
 * و گامی که به همه‌ی مقادیر می‌رسد. رسیدن به هر سرِ دامنه = برداشتنِ همان قید
 * (null)، تا محصولاتی که بعداً لود می‌شوند و بیرونِ دامنه‌ی فعلی‌اند حذف نشوند.
 */
function NumberRange({ attr, value, onChange }) {
  const lo = Number(attr.min);
  const hi = Number(attr.max);
  const step = attr.step > 0 ? attr.step : 1;
  const span = hi - lo;
  const min = value?.min ?? null;
  const max = value?.max ?? null;

  const commit = (nextMin, nextMax) => {
    const a = nextMin != null && nextMin > lo ? nextMin : null;
    const b = nextMax != null && nextMax < hi ? nextMax : null;
    onChange(a == null && b == null ? null : { min: a, max: b });
  };
  const setMin = (v) => commit(v == null ? null : Math.min(v, max ?? hi), max);
  const setMax = (v) => commit(min, v == null ? null : Math.max(v, min ?? lo));

  const sMin = clamp(min ?? lo, lo, hi);
  const sMax = clamp(max ?? hi, lo, hi);
  const pct = (v) => (span > 0 ? ((v - lo) / span) * 100 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <BoundInput value={min} placeholder={fmt(lo)} label={`حداقل ${attr.label}`} onCommit={setMin} />
        <span className="text-gray-300 font-bold shrink-0">—</span>
        <BoundInput value={max} placeholder={fmt(hi)} label={`حداکثر ${attr.label}`} onCommit={setMax} />
      </div>
      {span > 0 && (
        <div className="relative h-4" dir="rtl">
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full bg-gray-100" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--color-primary,#aa4725)]"
            style={{ right: `${pct(sMin)}%`, width: `${Math.max(0, pct(sMax) - pct(sMin))}%` }}
          />
          <input
            type="range" dir="rtl" min={lo} max={hi} step={step} value={sMin}
            aria-label={`حداقل ${attr.label}`}
            onChange={(e) => setMin(Number(e.target.value))}
            className={THUMB_INPUT_CLASS}
            // وقتی هر دو سر به انتها چسبیده‌اند، سرِ «کف» باید رو باشد تا قابل‌گرفتن بماند
            style={{ zIndex: pct(sMin) > 50 ? 5 : 3 }}
          />
          <input
            type="range" dir="rtl" min={lo} max={hi} step={step} value={sMax}
            aria-label={`حداکثر ${attr.label}`}
            onChange={(e) => setMax(Number(e.target.value))}
            className={THUMB_INPUT_CLASS}
            style={{ zIndex: 4 }}
          />
        </div>
      )}
      <div className="flex justify-between text-[10px] font-bold text-gray-400" dir="rtl">
        <span>{fmt(lo)}</span>
        <span>{fmt(hi)}</span>
      </div>
    </div>
  );
}

function AttrSection({ attr, attrFilters, setAttrFilters, defaultOpen, exactValues }) {
  const [open, setOpen] = useState(defaultOpen);
  const isColor = isColorAttribute(attr.name);
  const isRange =
    !exactValues && attr.type === "number" && Number.isFinite(attr.min) && Number.isFinite(attr.max);
  const raw = attrFilters[attr.name];
  // شکلِ انتخاب باید با نوعِ بخش بخواند؛ انتخابِ ناجور (مثلاً لینکِ قدیمی) نادیده.
  const range = isRange && isRangeSelection(raw) ? raw : null;
  const selected = !isRange && Array.isArray(raw) ? raw : [];
  const activeCount = isRange ? (range ? 1 : 0) : selected.length;

  const setSelection = (next) => {
    const all = { ...attrFilters };
    if (next) all[attr.name] = next;
    else delete all[attr.name];
    setAttrFilters(all);
  };
  const apply = (nextSel) => setSelection(nextSel.length ? nextSel : null);
  const pickColor = (name) =>
    exactValues ? apply(toggle(selected, name)) : apply(selected.includes(name) ? [] : [name]);

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
          {attr.label}
          {activeCount > 0 && (
            <span className="bg-[#aa4725] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeCount}
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
                    onClick={() => pickColor(c.name)}
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
          ) : isRange ? (
            <NumberRange attr={attr} value={range} onChange={setSelection} />
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
  exactValues = false,
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
          exactValues={exactValues}
        />
      ))}
    </>
  );
}
