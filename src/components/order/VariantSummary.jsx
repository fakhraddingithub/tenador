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
 */
function unitsText(units) {
  return Object.entries(units)
    .map(([u, v]) => `${v} ${u}`)
    .join(" / ");
}

export default function VariantSummary({
  snapshot,
  attributes,
  attributeImages,
  attributeUnits,
}) {
  const entries =
    Array.isArray(snapshot) && snapshot.length
      ? snapshot
      : Object.entries(attributes || {}).map(([name, value]) => ({
          name,
          label: name,
          value,
          image: attributeImages?.[name] || undefined,
          units: attributeUnits?.[name] || undefined,
        }));

  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((e, i) => {
        const text =
          e.units && Object.keys(e.units).length ? unitsText(e.units) : e.value;
        return (
          <span
            key={e.name || i}
            className="inline-flex items-center gap-1 text-xs bg-[#aa4725]/8 text-[#aa4725]
              border border-[#aa4725]/20 px-2 py-0.5 rounded-full font-medium"
          >
            {e.image ? (
              <img
                src={e.image}
                alt={e.value}
                className="w-4 h-4 rounded-full object-cover border border-[#aa4725]/20"
              />
            ) : (
              <span className="text-slate-500 text-[10px]">{e.label || e.name}:</span>
            )}
            {text}
          </span>
        );
      })}
    </div>
  );
}
