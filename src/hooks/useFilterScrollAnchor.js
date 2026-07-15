"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// روی سرور useLayoutEffect اجرا نمی‌شود و هشدار می‌دهد؛ پس روی سرور useEffect (بی‌اثر)
// و روی کلاینت useLayoutEffect (پیش از paint → بدون فلش/پرش) استفاده می‌شود.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * src/hooks/useFilterScrollAnchor.js
 *
 * با هر «به‌روزرسانیِ نتیجه‌ی فیلتر»، موقعیتِ اسکرولِ کاربر را دقیقاً همان‌جا که
 * بود نگه می‌دارد — نه پرش به بالا، نه افتادنِ نما روی فوتر.
 *
 * مشکل: وقتی نتیجه‌ی فیلتر کوتاه‌تر می‌شود، ارتفاعِ سند کم می‌شود و مرورگر اسکرول
 * را به بیشینه‌ی جدید clamp می‌کند → نمای کاربر ناگهان روی فوتر/فضای پایین می‌افتد
 * (پرشِ ناخواسته). راه‌حل: به کانتینرِ ردیفِ «فیلتر + نتایج» فقط به‌اندازه‌ای
 * min-height می‌دهیم که ارتفاعِ سند برای حفظِ اسکرولِ فعلی کافی بماند؛ سپس اگر
 * مرورگر حین reflow اسکرول را جابه‌جا کرده بود، همان مقدارِ قبلی را برمی‌گردانیم.
 *
 * رفتار:
 *  - هیچ‌وقت خودش اسکرول را جابه‌جا نمی‌کند؛ فقط جابه‌جاییِ ناخواسته‌ی مرورگر را
 *    خنثی می‌کند (سایدبارِ فیلتر در همان جای قبلی می‌ماند).
 *  - جبرانِ ارتفاع با هر تغییرِ فیلتر از نو محاسبه می‌شود (اگر لیست دوباره بلند
 *    شود، فضای خالیِ اضافه برداشته می‌شود).
 *  - با pagination/infinite-scroll تداخلی ندارد: بلندشدنِ لیست کسری ایجاد نمی‌کند.
 *  - پیش از paint (useLayoutEffect) اجرا می‌شود تا هیچ فریمِ پرش‌داری دیده نشود.
 *
 * @param {React.RefObject<HTMLElement>} anchorRef ref به کانتینرِ ردیفِ فیلتر+نتایج
 * @param {*} signal مقداری که با هر «به‌روزرسانیِ نتیجه‌ی فیلتر» تغییر می‌کند
 *   (تعدادِ نتایج برای صفحاتِ کلاینت‌ساید، یا یک توکن برای صفحاتِ infinite-scroll
 *    که فقط هنگامِ اعمالِ فیلتر — نه loadMore — تغییر می‌کند).
 */
export default function useFilterScrollAnchor(anchorRef, signal) {
  const mounted = useRef(false);

  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // اولین اجرا (بارگذاریِ صفحه / بازگشت با اسکرولِ بازیابی‌شده) را دست نمی‌زنیم؛
    // فقط به تغییرِ واقعیِ فیلتر واکنش نشان می‌دهیم.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = anchorRef.current;
    if (!el) return;

    // پیش از هر خواندنِ layout (که reflow و clampِ اسکرول را فعال می‌کند)
    // موقعیتِ فعلی را ثبت می‌کنیم.
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;

    // جبرانِ قبلی را آزاد کن تا ارتفاعِ طبیعیِ محتوا سنجیده شود.
    el.style.minHeight = "";
    const naturalHeight = el.offsetHeight;
    const docHeight = document.documentElement.scrollHeight;

    // اگر سندِ کوتاه‌شده دیگر جای اسکرولِ فعلی را ندارد، دقیقاً همان کسری را
    // به کانتینر اضافه کن تا اسکرول سرِ جایش معتبر بماند.
    const deficit = scrollY + viewportHeight - docHeight;
    if (deficit > 0) {
      el.style.minHeight = `${naturalHeight + deficit}px`;
    }

    // اگر مرورگر حین reflow اسکرول را clamp کرده بود، همان مقدارِ قبلی را برگردان.
    if (window.scrollY !== scrollY) {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    }
  }, [signal]);
}
