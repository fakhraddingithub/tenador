// Shared product content/structured-data release (3660833, 2026-10-19).
// Keep this fixed between significant product-template releases, not every build.
const PRODUCT_CONTENT_RELEASE = Date.parse("2026-10-19T21:44:07Z");

export function productLastModified(updatedAt) {
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : NaN;
  return new Date(
    Number.isFinite(timestamp)
      ? Math.max(timestamp, PRODUCT_CONTENT_RELEASE)
      : PRODUCT_CONTENT_RELEASE,
  );
}
