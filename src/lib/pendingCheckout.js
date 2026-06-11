/**
 * src/lib/pendingCheckout.js
 *
 * نگهداری موقت اطلاعات صفحه «ثبت سفارش» (آدرس، روش پرداخت، کوپن، توضیحات)
 * در sessionStorage تا زمان تکمیل پرداخت.
 *
 * سفارش فقط پس از ثبت موفق پرداخت/اقساط در سرور ساخته می‌شود؛ بنابراین تا آن
 * لحظه کاربر می‌تواند به سبد برگردد، آن را تغییر دهد و دوباره ادامه دهد.
 */

const KEY = "pendingCheckout";

export function savePendingCheckout(data) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ ...data, savedAt: Date.now() }),
  );
}

export function getPendingCheckout() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.paymentMethod) return null;
    if (!parsed.addressId && !parsed.addressSnapshot) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
