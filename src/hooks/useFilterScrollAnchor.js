"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// روی سرور useLayoutEffect اجرا نمی‌شود و هشدار می‌دهد؛ پس روی سرور useEffect (بی‌اثر)
// و روی کلاینت useLayoutEffect (پیش از paint → بدون فلشِ فوتر) استفاده می‌شود.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * src/hooks/useFilterScrollAnchor.js
 *
 * هنگام تغییرِ فیلترها روی صفحاتِ لیستِ محصول، اگر کوتاه‌شدنِ ناگهانیِ لیست باعث
 * شود ارتفاعِ صفحه کم شود، مرورگر موقعیتِ اسکرول را نگه می‌دارد و نمای کاربر روی
 * فوتر (یا ناحیه‌ای پایین‌ترِ نتایج) می‌افتد. این هوک نمای صفحه را دوباره به بالای
 * «ناحیه‌ی فیلتر/نتایج» لنگر می‌اندازد تا کاربر در همان ناحیه‌ی فیلترینگ بماند.
 *
 * رفتار (پایدار و بدون پرشِ اضافه):
 *  - فقط وقتی تصحیح می‌کند که پس از به‌روزرسانی، نمای کاربر به «پایین‌ترِ ناحیه‌ی
 *    فیلتر/نتایج» افتاده باشد (یعنی فوتر/فضای خالی دیده می‌شود). این شرط مستقیماً
 *    سنجیده می‌شود و به تاریخچه‌ی ارتفاع وابسته نیست، پس با pagination/infinite-scroll
 *    هم درست کار می‌کند (بزرگ‌شدنِ لیست هیچ تصحیحی ایجاد نمی‌کند).
 *  - فقط وقتی بالا می‌رود که کاربر واقعاً پایین‌ترِ ابتدای ناحیه‌ی فیلتر باشد؛ اگر
 *    همان حوالی یا بالاتر باشد (مثلاً در حالِ تایپ در جستجو) هیچ پرشی رخ نمی‌دهد.
 *  - هرگز به بالای صفحه یا به سمتِ فوتر پرش نمی‌کند؛ لنگر، بالای کانتینرِ فیلتر است.
 *  - روی کلاینت در useLayoutEffect (پیش از paint) اجرا می‌شود تا تصحیح بدونِ فلش باشد.
 *
 * @param {React.RefObject<HTMLElement>} anchorRef ref به کانتینرِ ردیفِ فیلتر+نتایج
 * @param {*} signal مقداری که با هر «به‌روزرسانیِ نتیجه‌ی فیلتر» تغییر می‌کند
 *   (تعدادِ نتایج برای صفحاتِ کلاینت‌ساید، یا یک توکن برای صفحاتِ infinite-scroll
 *    که داده را async می‌گیرند و فقط هنگامِ اعمالِ فیلتر — نه loadMore — تغییر می‌کند).
 * @param {number} [offset=90] فاصله از بالای ویوپورت (ارتفاعِ نوار ناوبریِ ثابت
 *   h-[75px] + کمی فاصله) تا کانتینر زیرِ ناوبری بنشیند.
 */
export default function useFilterScrollAnchor(anchorRef, signal, offset = 90) {
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

    const rect = el.getBoundingClientRect();
    const anchorTop = rect.top + window.scrollY; // بالای ناحیه‌ی فیلتر (مختصاتِ سند)
    const listingBottom = anchorTop + el.offsetHeight; // پایینِ ناحیه‌ی فیلتر/نتایج
    const target = Math.max(0, anchorTop - offset);
    const viewportBottom = window.scrollY + window.innerHeight;

    // اگر نمای کاربر تا پایین‌ترِ ناحیه‌ی نتایج رفته (فوتر دیده می‌شود) و کاربر هم
    // پایین‌ترِ ابتدای ناحیه‌ی فیلتر است → تا بالای ناحیه‌ی فیلتر بالا می‌آییم.
    // در غیرِ این صورت (لیست بلند است، یا کاربر همان بالاست) هیچ کاری نمی‌کنیم.
    if (viewportBottom > listingBottom && window.scrollY > target) {
      window.scrollTo({ top: target, behavior: "auto" });
    }
  }, [signal]);
}
