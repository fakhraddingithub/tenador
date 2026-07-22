"use client";

/**
 * src/components/common/NotFoundLoaderReset.jsx
 *
 * جزیره‌ی کوچکِ کلاینتی که داخلِ محتوای صفحه‌ی ۴۰۴ رندر می‌شود و هنگامِ mount
 * یک رویداد پخش می‌کند تا [[NavigationLoader]] لودرِ ناوبری را ببندد.
 *
 * چرا لازم است؟ وقتی یک ناوبریِ کلاینتی با `notFound()` به مقصد می‌رسد، App Router
 * (که layout ریشه‌اش داخلِ گروهِ (Site) است) نه ترنزیشن را جمع می‌کند (isPending
 * روی true می‌ماند) و نه usePathname را به‌روزرسانی می‌کند. این دو تنها سیگنال‌های
 * بستنِ لودر بودند؛ پس لودر روی صفحه‌ی ۴۰۴ گیر می‌کرد. خودِ صفحه‌ی ۴۰۴ که واقعاً
 * رندر شده، مرجعِ قطعیِ «مقصد آمد» است — پس همین‌جا سیگنالِ بستن را می‌فرستیم.
 *
 * روی لودِ مستقیم/رفرش هم mount می‌شود، اما آنجا showLoader از قبل false است پس
 * بی‌اثر است. در ۴۰۴ سراسری (src/app/not-found.jsx با <html> مستقلِ خودش)
 * NavigationLoader اصلاً mount نیست، پس رویداد شنونده‌ای ندارد و بی‌ضرر است.
 */

import { useEffect } from "react";
import { NOT_FOUND_RENDERED_EVENT } from "./navigationLoaderEvents";

export default function NotFoundLoaderReset() {
  useEffect(() => {
    window.dispatchEvent(new Event(NOT_FOUND_RENDERED_EVENT));
  }, []);

  return null;
}
