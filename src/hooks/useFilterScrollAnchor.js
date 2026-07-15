"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// روی سرور useLayoutEffect اجرا نمی‌شود و هشدار می‌دهد؛ پس روی سرور useEffect (بی‌اثر)
// و روی کلاینت useLayoutEffect (پیش از paint → بدون فلش/پرش) استفاده می‌شود.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ارتفاعِ نوبارِ fixed سایت (h-[64px] موبایل / lg:h-[75px] دسکتاپ) + کمی فاصله،
// تا وقتی نما به ابتدای ناحیه‌ی فیلتر برمی‌گردد، زیرِ نوبار پنهان نشود.
const FIXED_NAV_OFFSET = 90;

/**
 * src/hooks/useFilterScrollAnchor.js
 *
 * با هر «به‌روزرسانیِ نتیجه‌ی فیلتر» نمای کاربر را روی ناحیه‌ی «فیلتر + نتایج»
 * نگه می‌دارد:
 *
 *  - اگر سند هنوز برای اسکرولِ فعلی جا دارد → هیچ جابه‌جایی‌ای رخ نمی‌دهد
 *    (سایدبارِ فیلتر دقیقاً همان‌جا که بود می‌ماند؛ فقط لیست عوض می‌شود).
 *  - اگر نتیجه‌ی فیلتر آن‌قدر کوتاه شد که سند دیگر جای اسکرولِ فعلی را ندارد
 *    (مرورگر اسکرول را clamp می‌کند و نما روی فوتر می‌افتد) → به‌جای ماندن روی
 *    فوتر، نما به ابتدای ناحیه‌ی فیلتر+نتایج برمی‌گردد (زیرِ نوبارِ fixed).
 *
 * پیش از paint (useLayoutEffect) اجرا می‌شود تا هیچ فریمِ پرش‌داری دیده نشود،
 * و هرگز نما را به پایین نمی‌بَرد (فقط در صورتِ نیاز به بالا برمی‌گردد).
 * با pagination/infinite-scroll تداخلی ندارد: بلندشدنِ لیست کسری ایجاد نمی‌کند.
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
    const docHeight = document.documentElement.scrollHeight;

    // کسری = چقدر از اسکرولِ فعلی دیگر در سندِ کوتاه‌شده جا نمی‌شود.
    const deficit = scrollY + viewportHeight - docHeight;

    if (deficit <= 0) {
      // سند هنوز جا دارد؛ اگر مرورگر حین reflow اسکرول را جابه‌جا کرده بود،
      // همان مقدارِ قبلی را برگردان (بدون هیچ پرشی).
      if (window.scrollY !== scrollY) {
        window.scrollTo({ top: scrollY, behavior: "auto" });
      }
      return;
    }

    // سند کوتاه‌تر از اسکرولِ فعلی شده → نما را به ابتدای ناحیه‌ی فیلتر+نتایج
    // برگردان (موقعیتِ مطلق در سند، مستقل از این‌که clamp رخ داده یا نه).
    const anchorTop = Math.max(
      0,
      el.getBoundingClientRect().top + window.scrollY - FIXED_NAV_OFFSET,
    );
    // هرگز به پایین اسکرول نکن؛ فقط اگر کاربر پایین‌تر از ناحیه است، بالا بیا.
    const target = Math.min(scrollY, anchorTop);
    if (window.scrollY !== target) {
      window.scrollTo({ top: target, behavior: "auto" });
    }
  }, [signal]);
}
