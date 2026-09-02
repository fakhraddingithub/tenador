"use client";

/**
 * src/components/print/PrintToolbar.jsx
 *
 * تنها بخشِ کلاینتیِ صفحه‌ی چاپ: یک بار خودکار چاپ می‌کند و دکمه‌ی «چاپ دوباره»
 * می‌دهد.
 *
 * هیچ DOMی را دست‌کاری نمی‌کند و هیچ پنجره‌ای باز نمی‌کند — فقط
 * `window.print()` روی *همین* سند. لغوِ دیالوگِ چاپ صرفاً یعنی promise چیزی
 * برنمی‌گرداند؛ چیزی برای برگرداندن به حالتِ اول وجود ندارد.
 */

import { useEffect } from "react";

export default function PrintToolbar({ auto = true }) {
  useEffect(() => {
    if (!auto) return;

    // چاپ قبل از سوارشدنِ فونت، اندازه‌ها را جابه‌جا می‌کند.
    // `cancelled` برای اجرای دوباره‌ی افکت در StrictMode است.
    let cancelled = false;
    const go = () => {
      if (!cancelled) window.print();
    };

    const ready =
      typeof document !== "undefined" && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve();
    ready.then(go, go);

    return () => {
      cancelled = true;
    };
  }, [auto]);

  return (
    <div className="toolbar">
      <button type="button" className="toolbar__btn" onClick={() => window.print()}>
        چاپ برگه
      </button>
      <span className="toolbar__hint">
        در تنظیماتِ چاپ، اندازه را A4 و جهت را افقی (Landscape) انتخاب کنید.
      </span>
    </div>
  );
}
