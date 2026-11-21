// هر ویژگی یا آرایه‌ای از مقادیر است (دکمه/رنگ) یا بازه‌ی عددیِ { min, max }
// (null = بدونِ کف/سقف) — همان شکلی که src/lib/attributeFilters.js می‌سازد.
const isBound = (v) => v === null || v === undefined || (typeof v === "number" && Number.isFinite(v));

export function parseCategoryAttributes(raw) {
  if (!raw) return {};
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new TypeError("Invalid attribute filters");
  const entries = Object.entries(parsed);
  if (entries.length > 50) throw new TypeError("Too many attribute filters");
  const result = Object.create(null);
  for (const [name, values] of entries) {
    if (name.length > 160) throw new TypeError("Invalid attribute values");
    if (values && typeof values === "object" && !Array.isArray(values)) {
      const { min = null, max = null } = values;
      if (Object.keys(values).some((k) => k !== "min" && k !== "max") || !isBound(min) || !isBound(max) ||
        (min != null && max != null && min > max)) throw new TypeError("Invalid attribute range");
      if (min != null || max != null) result[name] = { min, max };
      continue;
    }
    if (!Array.isArray(values) || values.length > 30 ||
      values.some((v) => typeof v !== "string" || v.length > 200)) throw new TypeError("Invalid attribute values");
    if (values.length) result[name] = [...new Set(values)];
  }
  return result;
}
