"use client";

/**
 * src/components/common/InitialLoadLoaderDismiss.jsx
 *
 * پشتیبانِ بستنِ اورلیِ لودِ اولیه ([[InitialLoadLoader]]) از سمتِ ری‌اکت.
 *
 * چرا لازم است؟ اورلیِ لودِ اولیه با یک <script> inline (داخلِ dangerouslySetInnerHTML)
 * خودش را می‌بندد و روی load/readyState متکی است. اما در صفحاتِ notFound()/error،
 * Next بدنه‌ی layout (شاملِ همان <script>) را در شِلِ اولیه‌ی HTML قرار نمی‌دهد و
 * فقط به‌صورتِ داده‌ی RSC می‌فرستد؛ کلاینت آن را با dangerouslySetInnerHTML درج می‌کند
 * و «اسکریپتِ درج‌شده با innerHTML هرگز اجرا نمی‌شود». نتیجه: در صفحه‌ی ۴۰۴ اسکریپتِ
 * مخفی‌کننده اجرا نمی‌شود، data-tnd-il-done ست نمی‌شود و اورلی برای همیشه می‌ماند.
 *
 * این کامپوننتِ کلاینتی—برخلافِ آن اسکریپت—روی صفحه‌ی ۴۰۴ هم هیدریت و اجرا می‌شود،
 * پس با همان شرطِ زمانیِ اسکریپت (load/complete) اتریبیوتِ قفلِ دائمی را می‌گذارد تا
 * قانونِ CSSِ خودِ اورلی (html[data-tnd-il-done] → display:none) آن را پنهان کند.
 * چون شرطِ بستن دقیقاً همان قبلی است، رفتارِ صفحاتِ عادی تغییری نمی‌کند.
 */

import { useEffect } from "react";

export default function InitialLoadLoaderDismiss() {
  useEffect(() => {
    const markDone = () =>
      document.documentElement.setAttribute("data-tnd-il-done", "");

    if (document.readyState === "complete") {
      markDone();
      return;
    }
    window.addEventListener("load", markDone, { once: true });
    return () => window.removeEventListener("load", markDone);
  }, []);

  return null;
}
