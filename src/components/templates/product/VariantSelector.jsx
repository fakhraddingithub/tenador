"use client";

import Image from "next/image";

/**
 * انتخابگرِ مشترکِ واریانت (Change 4) — هم در صفحه محصول (ProductInfo) و هم در
 * کوییک‌ویو استفاده می‌شود تا منطق و ظاهر یکسان بماند.
 *
 * - اگر مقدارِ یک ویژگی تصویر داشته باشد (از variantMeta) دکمه‌اش thumbnail می‌شود؛
 *   در غیر این صورت دکمه‌ی متنی (رفتارِ قبلی).
 * - برچسبِ ویژگی و مقدارِ انتخاب‌شده همیشه به‌صورت متن نمایش داده می‌شود
 *   («رنگ: قرمز») حتی وقتی دکمه تصویری است.
 * - دکمه‌های تصویری دارای aria-label و title هستند (دسترس‌پذیری).
 *
 * props:
 *   optionKeys     [attrName]
 *   variantOptions { attrName: [values] }
 *   labelMap       { attrName: label }
 *   selection      { attrName: value }
 *   onSelect       (attrKey, value) => void
 *   getValueImage  (attrKey, value) => string | null
 *   getValueLabel  (attrKey, value) => string   // برای چندواحدی (Change 3)، پیش‌فرض خود مقدار
 *   isValueDisabled (attrKey, value) => bool     // cascade filtering (Bug 2): مقدارِ بدون واریانتِ معتبر غیرفعال می‌شود
 *   compact        فشرده‌تر برای کوییک‌ویو
 */
export default function VariantSelector({
  optionKeys = [],
  variantOptions = {},
  labelMap = {},
  selection = {},
  onSelect,
  getValueImage,
  getValueLabel,
  getUnits,
  getActiveUnit,
  onUnitChange,
  isValueDisabled,
  compact = false,
}) {
  if (!optionKeys.length) return null;

  const displayLabel = (attrKey, val) =>
    (getValueLabel ? getValueLabel(attrKey, val) : null) ?? val;

  return (
    <div className={compact ? "flex flex-col gap-4 sm:gap-5" : "space-y-5"}>
      {optionKeys.map((attrKey) => {
        const values = variantOptions[attrKey] || [];
        const label = labelMap[attrKey] || attrKey;
        const selectedValue = selection[attrKey];
        const units = getUnits ? getUnits(attrKey) : [];
        const activeUnit = getActiveUnit ? getActiveUnit(attrKey) : undefined;

        return (
          <div key={attrKey} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#aa4725] rounded-full shrink-0" />
                {label}
                {selectedValue && (
                  <span className="mr-1 font-normal text-gray-400">
                    <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                      {displayLabel(attrKey, selectedValue)}
                    </span>
                  </span>
                )}
              </p>

              {/* تعویضِ واحدِ نمایش (چندواحدی) — روی کلِ این ویژگی اعمال می‌شود */}
              {units.length > 1 && (
                <div
                  className="inline-flex rounded-[6px] border border-gray-200 overflow-hidden"
                  role="group"
                  aria-label={`واحد نمایشِ ${label}`}
                >
                  {units.map((u) => {
                    const active = activeUnit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => onUnitChange?.(attrKey, u)}
                        aria-pressed={active}
                        className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          active
                            ? "bg-[#aa4725] text-white"
                            : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {values.map((val) => {
                const isSelected = selectedValue === val;
                const img = getValueImage ? getValueImage(attrKey, val) : null;
                const text = displayLabel(attrKey, val);
                // cascade filtering: مقدارِ بدون واریانتِ معتبر برای انتخابِ جاری
                // غیرفعال می‌شود (مگر اینکه خودش انتخاب‌شده باشد)
                const disabled =
                  !isSelected && isValueDisabled
                    ? isValueDisabled(attrKey, val)
                    : false;

                if (img) {
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && onSelect(attrKey, val)}
                      title={disabled ? `${text} (ناموجود برای این انتخاب)` : text}
                      aria-label={`${label}: ${text}`}
                      aria-pressed={isSelected}
                      aria-disabled={disabled}
                      className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all
                        ${compact ? "w-12 h-12 sm:w-14 sm:h-14" : "w-14 h-14 sm:w-16 sm:h-16"}
                        ${
                          disabled
                            ? "border-gray-100 opacity-40 grayscale cursor-not-allowed"
                            : isSelected
                            ? "border-[#aa4725] shadow-md ring-2 ring-[#aa4725]/30"
                            : "border-gray-200 hover:border-[#aa4725]/50"
                        }`}
                    >
                      <Image
                        src={img}
                        alt={text}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  );
                }

                return (
                  <button
                    key={val}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && onSelect(attrKey, val)}
                    title={disabled ? `${text} (ناموجود برای این انتخاب)` : text}
                    aria-pressed={isSelected}
                    aria-disabled={disabled}
                    className={`relative rounded-lg border-2 text-sm font-medium transition-all select-none
                      flex items-center justify-center
                      ${
                        compact
                          ? "min-w-[52px] sm:min-w-[60px] px-3 sm:px-4 h-10"
                          : "min-w-[56px] px-4 h-11"
                      }
                      ${
                        disabled
                          ? "border-gray-100 text-gray-300 bg-gray-50 line-through cursor-not-allowed"
                          : isSelected
                          ? "border-[#aa4725] bg-[#aa4725]/5 text-[#aa4725] shadow-sm"
                          : "border-gray-200 text-gray-700 hover:border-[#aa4725]/50"
                      }`}
                  >
                    <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                      {text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
