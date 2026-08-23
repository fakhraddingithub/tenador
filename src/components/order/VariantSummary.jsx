/**
 * src/components/order/VariantSummary.jsx
 *
 * نمایشِ مشترکِ مشخصاتِ واریانتِ یک آیتمِ سفارش (Change 5).
 * اولویت با variantSnapshot است (پایدار، شاملِ تصویر و چندواحدی)؛ اگر نبود به
 * variant.attributes برمی‌گردد (سفارش‌های قدیمی).
 *
 * props:
 *   snapshot         [{ name, label, value, image?, units? }]   ← اولویت (سفارش)
 *   attributes       { name: value }                            ← فالبک (سبد/قدیمی)
 *   attributeImages  { name: imageUrl }                         ← تکمیلیِ شکلِ سبد
 *   attributeUnits   { name: { unit: value } }                  ← تکمیلیِ شکلِ سبد
 *   attributeLabels  { name: label }                            ← برچسب فارسی سبد
 */
function visibleUnits(units) {
  if (!units || typeof units !== "object") return [];

  return Object.entries(units).filter(
    ([unit, value]) => unit && value !== null && value !== undefined && value !== "",
  );
}

export default function VariantSummary({
  snapshot,
  attributes,
  attributeImages,
  attributeUnits,
  attributeLabels,
}) {
  const entries =
    Array.isArray(snapshot) && snapshot.length
      ? snapshot
      : Object.entries(attributes || {}).map(([name, value]) => ({
          name,
          label: attributeLabels?.[name] || name,
          value,
          image: attributeImages?.[name] || undefined,
          units: attributeUnits?.[name] || undefined,
        }));

  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5" dir="rtl" role="list">
      {entries.map((e, i) => {
        const units = visibleUnits(e.units);
        const label = e.label || attributeLabels?.[e.name] || e.name;

        return (
          <div
            key={e.name || i}
            role="listitem"
            aria-label={
              units.length
                ? `${label}: ${units.map(([unit, value]) => `${unit}: ${value}`).join("، ")}`
                : `${label}: ${e.value}`
            }
            className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg
              border border-[#aa4725]/20 bg-[#aa4725]/8 px-2 py-1 text-xs text-[#aa4725]"
          >
            {e.image && (
              <img
                src={e.image}
                alt={e.value}
                className="h-4 w-4 shrink-0 rounded-full border border-[#aa4725]/20 object-cover"
              />
            )}

            <span className="shrink-0 font-semibold text-slate-600">
              {label}<span aria-hidden="true">:</span>
            </span>

            {units.length ? (
              <span className="inline-flex flex-wrap items-center gap-1" aria-hidden="true">
                {units.map(([unit, value]) => (
                  <span
                    key={unit}
                    dir="ltr"
                    style={{ direction: "ltr" }}
                    className="inline-flex whitespace-nowrap rounded-md bg-white/80 px-1.5 py-0.5 font-medium shadow-sm ring-1 ring-[#aa4725]/10"
                  >
                    <bdi dir="auto">{unit}</bdi>
                    <span className="mx-0.5 text-slate-400">:</span>
                    <bdi dir="ltr" className="font-semibold text-[#aa4725]">{value}</bdi>
                  </span>
                ))}
              </span>
            ) : (
              <bdi dir="auto" className="font-semibold">{e.value}</bdi>
            )}
          </div>
        );
      })}
    </div>
  );
}
