export const LISTING_PAGE_SIZE = 20;
export function listingPage(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return /^\d+$/.test(String(raw || "")) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : 1;
}
export function listingCanonical(path, page) {
  const n = listingPage(page);
  return n > 1 ? path + "?page=" + n : path;
}
