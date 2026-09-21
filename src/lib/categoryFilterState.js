export function parseCategoryAttributes(raw) {
  if (!raw) return {};
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new TypeError("Invalid attribute filters");
  const entries = Object.entries(parsed);
  if (entries.length > 50) throw new TypeError("Too many attribute filters");
  const result = Object.create(null);
  for (const [name, values] of entries) {
    if (name.length > 160 || !Array.isArray(values) || values.length > 30 ||
      values.some((v) => typeof v !== "string" || v.length > 200)) throw new TypeError("Invalid attribute values");
    if (values.length) result[name] = [...new Set(values)];
  }
  return result;
}
