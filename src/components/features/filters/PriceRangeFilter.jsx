"use client";

/**
 * src/components/features/filters/PriceRangeFilter.jsx
 *
 * فیلترِ قیمتِ مشترکِ همه‌ی صفحات لیستِ محصول (فروشگاه، ورزش/دسته، برند، سری،
 * کمپین و دست‌دوم): اسلایدرِ دوسَره (کمینه + بیشینه) + دو اینپوتِ عددی با
 * جداکننده‌ی هزارگان (کاما) که همیشه با اسلایدر همگام‌اند.
 *
 * قرارداد مقدار: { min, max } به تومان؛ مقدارِ 0 یعنی «بدون کف/سقف» (همان
 * قراردادِ API های grouped). وقتی سرِ اسلایدر به انتهای دامنه می‌رسد 0 ارسال
 * می‌شود تا با بارگذاریِ تدریجیِ محصولاتِ گران‌تر، سقفِ ناخواسته نماند.
 *
 * دامنه‌ی اسلایدر (bounds.max) از بیرون از روی محصولاتِ موجود محاسبه می‌شود؛
 * این کامپوننت آن را «گرد» و «فقط رو به بالا» (ratchet) نگه می‌دارد تا با
 * فیلترشدنِ نتایج، دامنه جمع نشود و سرِ اسلایدر نپَرد.
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** قیمتِ نمایشیِ کارتِ محصول (تومان) — همان قراردادِ priceEngine. */
export const getListingPriceToman = (p) =>
  p?.finalPriceToman ?? p?.basePriceToman ?? 0;

/** سقفِ دامنه را به عددِ خوانا گرد می‌کند (مثلاً ۸۷٬۴۰۰٬۰۰۰ → ۹۰٬۰۰۰٬۰۰۰). */
function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 50_000_000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const unit = Math.max(1, magnitude / 2);
  return Math.ceil(value / unit) * unit;
}

// ارقام فارسی/عربی هم پذیرفته می‌شوند (کیبوردهای موبایل).
const normalizeDigits = (s) =>
  String(s)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const parseNum = (s) => {
  const digits = normalizeDigits(s).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

const fmt = (n) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// استایلِ سرهای اسلایدر: خودِ اینپوت pointer-events ندارد تا دو اینپوتِ
// روی‌هم فقط از طریق سرهایشان قابل‌گرفتن باشند (الگوی استانداردِ dual-range).
const THUMB_INPUT_CLASS =
  "absolute inset-0 w-full appearance-none bg-transparent pointer-events-none outline-none " +
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-[var(--color-primary,#aa4725)] [&::-webkit-slider-thumb]:shadow " +
  "[&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-[var(--color-primary,#aa4725)] [&::-moz-range-thumb]:shadow " +
  "[&::-moz-range-thumb]:cursor-pointer";

export default function PriceRangeFilter({
  bounds = { min: 0, max: 0 },
  value = { min: 0, max: 0 },
  onChange = () => {},
  title = "محدوده قیمت (تومان)",
  className = "",
}) {
  // ── دامنه: گرد + ratchet (فقط بزرگ می‌شود تا با فیلترشدنِ نتایج جمع نشود) ──
  const incomingMax = Number(bounds?.max) || 0;
  const [maxSeen, setMaxSeen] = useState(incomingMax);
  useEffect(() => {
    if (incomingMax > maxSeen) {
      // نگهداریِ بیشینه‌ی دیده‌شده — همگام‌سازی با ورودیِ بیرونی (قراردادِ این کدبیس)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaxSeen(incomingMax);
    }
  }, [incomingMax, maxSeen]);
  const boundMin = 0;
  const boundMax = niceCeil(Math.max(maxSeen, incomingMax));
  // step باید مقسوم‌علیهِ دامنه باشد تا سرِ اسلایدر بتواند دقیقاً به انتها برسد
  // (رسیدن به انتها = برداشتنِ سقف). ۱۰۰ پله؛ boundMax گرد است پس step هم خواناست.
  const step = useMemo(
    () => Math.max(1, (boundMax - boundMin) / 100),
    [boundMax],
  );

  const valMin = Math.max(0, Number(value?.min) || 0);
  const valMax = Math.max(0, Number(value?.max) || 0); // 0 = بدون سقف

  // مقادیرِ سرهای اسلایدر (سنتینلِ 0 → انتهای دامنه؛ مقدارِ خارج از دامنه clamp می‌شود)
  const sliderMin = clamp(valMin, boundMin, boundMax);
  const sliderMax = valMax > 0 ? clamp(valMax, boundMin, boundMax) : boundMax;

  // مقادیرِ نمایشیِ اینپوت‌ها (مقدارِ واقعیِ کاربر، حتی اگر از دامنه‌ی اسلایدر بزرگ‌تر باشد)
  const displayMin = valMin;
  const displayMax = valMax > 0 ? valMax : boundMax;

  // ── اینپوت‌های متنی با state محلی تا حینِ تایپ، فرمتِ بیرونی متن را نبلعد ──
  const [minText, setMinText] = useState(fmt(displayMin));
  const [maxText, setMaxText] = useState(fmt(displayMax));
  const editingRef = useRef(null); // "min" | "max" | null

  useEffect(() => {
    if (editingRef.current !== "min") setMinText(fmt(displayMin));
  }, [displayMin]);
  useEffect(() => {
    if (editingRef.current !== "max") setMaxText(fmt(displayMax));
  }, [displayMax]);

  const commit = (min, max) => onChange({ min, max });

  const onMinInput = (raw) => {
    const parsed = parseNum(raw);
    setMinText(parsed === null ? "" : fmt(parsed));
    // کف نمی‌تواند از سقفِ فعال بیشتر شود
    const capped =
      parsed === null ? 0 : valMax > 0 ? Math.min(parsed, valMax) : parsed;
    commit(capped, valMax);
  };

  const onMaxInput = (raw) => {
    const parsed = parseNum(raw);
    setMaxText(parsed === null ? "" : fmt(parsed));
    // خالی = بدون سقف؛ سقف نمی‌تواند از کف کمتر شود
    const capped = parsed === null ? 0 : Math.max(parsed, valMin);
    commit(valMin, capped);
  };

  const onBlurInput = () => {
    editingRef.current = null;
    setMinText(fmt(displayMin));
    setMaxText(fmt(displayMax));
  };

  const onSliderMinChange = (raw) => {
    const v = Math.min(Number(raw), sliderMax);
    // رسیدن به ابتدای دامنه = بدون کف (0)
    commit(v <= boundMin ? 0 : v, valMax);
  };

  const onSliderMaxChange = (raw) => {
    const v = Math.max(Number(raw), sliderMin);
    // رسیدن به انتهای دامنه = بدون سقف (0) تا محصولاتِ گران‌ترِ بعدی حذف نشوند
    commit(valMin, v >= boundMax ? 0 : v);
  };

  const pct = (v) => ((v - boundMin) / (boundMax - boundMin)) * 100;
  const minPct = pct(sliderMin);
  const maxPct = pct(sliderMax);

  return (
    <div className={className}>
      <h4 className="text-sm font-bold text-[#1a1a1a] mb-4">{title}</h4>
      <div className="flex flex-col gap-4">
        {/* اینپوت‌های عددی با جداکننده‌ی هزارگان — همگام با اسلایدر */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            placeholder="از"
            aria-label="حداقل قیمت (تومان)"
            value={minText}
            onFocus={() => (editingRef.current = "min")}
            onBlur={onBlurInput}
            onChange={(e) => onMinInput(e.target.value)}
            className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 text-center focus:border-[var(--color-primary,#aa4725)] outline-none font-bold"
          />
          <span className="text-gray-300 font-bold shrink-0">—</span>
          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            placeholder="تا"
            aria-label="حداکثر قیمت (تومان)"
            value={maxText}
            onFocus={() => (editingRef.current = "max")}
            onBlur={onBlurInput}
            onChange={(e) => onMaxInput(e.target.value)}
            className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 text-center focus:border-[var(--color-primary,#aa4725)] outline-none font-bold"
          />
        </div>

        {/* اسلایدرِ دوسَره — بخشِ انتخاب‌شده با رنگِ اصلی هایلایت می‌شود */}
        <div className="relative h-4" dir="rtl">
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full bg-gray-100" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--color-primary,#aa4725)]"
            style={{
              right: `${minPct}%`,
              width: `${Math.max(0, maxPct - minPct)}%`,
            }}
          />
          <input
            type="range"
            dir="rtl"
            min={boundMin}
            max={boundMax}
            step={step}
            value={sliderMin}
            aria-label="حداقل قیمت"
            onChange={(e) => onSliderMinChange(e.target.value)}
            className={THUMB_INPUT_CLASS}
            // وقتی هر دو سر به انتهای دامنه چسبیده‌اند، سرِ «کف» باید بالاتر باشد تا قابل‌گرفتن بماند
            style={{ zIndex: sliderMin > boundMin + (boundMax - boundMin) / 2 ? 5 : 3 }}
          />
          <input
            type="range"
            dir="rtl"
            min={boundMin}
            max={boundMax}
            step={step}
            value={sliderMax}
            aria-label="حداکثر قیمت"
            onChange={(e) => onSliderMaxChange(e.target.value)}
            className={THUMB_INPUT_CLASS}
            style={{ zIndex: 4 }}
          />
        </div>

        {/* برچسبِ دامنه زیر اسلایدر */}
        <div className="flex justify-between text-[10px] font-bold text-gray-400" dir="rtl">
          <span>۰</span>
          <span>{boundMax.toLocaleString("fa-IR")}</span>
        </div>
      </div>
    </div>
  );
}
