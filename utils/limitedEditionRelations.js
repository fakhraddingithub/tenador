/**
 * آرایه‌ی شناسه‌های برند را به رشته‌های یکتا تبدیل می‌کند.
 * populated document، ObjectId و رشته را می‌پذیرد؛ اعتبار ObjectId در لایه‌ی
 * سرور انجام می‌شود تا این helper خالص و قابل تست باقی بماند.
 */
export function normalizeRelatedBrandIds(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;

  const ids = [];
  const seen = new Set();
  for (const raw of value) {
    const id = raw && typeof raw === "object" && raw._id ? raw._id : raw;
    const normalized = id == null ? "" : String(id).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

export function escapeRegexLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
