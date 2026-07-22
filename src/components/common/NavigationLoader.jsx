"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import RouteLoader from "./RouteLoader";
import { NOT_FOUND_RENDERED_EVENT } from "./navigationLoaderEvents";

// مسیرهایی که در همین نشستِ کلاینتی یک‌بار کامل لود شده‌اند (pathname + search).
// بازدیدِ دوباره‌ی این مسیرها از کشِ روتر فوری است؛ نمایش لودر فقط یک فلاشِ
// چندمیلی‌ثانیه‌ای می‌سازد، پس برای آن‌ها لودر نشان نمی‌دهیم.
// module-level است تا بین رندرها بماند؛ با رفرش/لود کامل سند خودبه‌خود خالی می‌شود.
const visitedRoutes = new Set();

export default function NavigationLoader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [showLoader, setShowLoader] = useState(false);
  const pendingRouteRef = useRef(null);

  // ناوبریِ عادی که کامل شد pathname عوض می‌شود؛ لودر را ببند.
  useEffect(() => {
    if (pendingRouteRef.current) {
      visitedRoutes.add(pendingRouteRef.current);
      pendingRouteRef.current = null;
    }
    setShowLoader(false);
  }, [pathname]);

  // مسیرِ ۴۰۴: وقتی router.push به notFound می‌رسد، App Router نه ترنزیشن را جمع
  // می‌کند (isPending روی true می‌ماند) و نه usePathname را عوض می‌کند؛ پس effectِ
  // بالا اجرا نمی‌شود و لودر گیر می‌کند. خودِ صفحه‌ی ۴۰۴ هنگامِ رندر این رویداد را
  // می‌فرستد ([[NotFoundLoaderReset]]) تا لودر قطعی بسته شود.
  useEffect(() => {
    function handleNotFoundRendered() {
      if (pendingRouteRef.current) {
        visitedRoutes.add(pendingRouteRef.current);
        pendingRouteRef.current = null;
      }
      setShowLoader(false);
    }
    window.addEventListener(NOT_FOUND_RENDERED_EVENT, handleNotFoundRendered);
    return () =>
      window.removeEventListener(NOT_FOUND_RENDERED_EVENT, handleNotFoundRendered);
  }, []);

  // صفحه‌ای که کاربر الان روی آن است، از همان ابتدا «بازدیدشده» حساب می‌شود
  useEffect(() => {
    visitedRoutes.add(window.location.pathname + window.location.search);
  }, []);

  // وقتی ترنزیشنِ ناوبری کامل شد یعنی مقصد واقعاً لود شده؛ علامتش بزن
  useEffect(() => {
    if (!isPending && pendingRouteRef.current) {
      visitedRoutes.add(pendingRouteRef.current);
      pendingRouteRef.current = null;
    }
  }, [isPending]);

  useEffect(() => {
    function handleClick(event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = event.target?.closest?.("a");
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;
      if (
        anchor.hasAttribute("rel") &&
        anchor.getAttribute("rel")?.includes("external")
      ) {
        return;
      }

      let url;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin !== window.location.origin) return;

      const samePage =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;

      if (samePage) {
        // لینکِ لنگردار به همین صفحه (#section): اسکرولِ پیش‌فرض مرورگر حفظ شود
        if (url.hash) return;

        // کلیک روی لینکِ همان صفحه‌ی فعلی: مثل رفرش با لودر رفتار می‌کنیم —
        // به‌جای لود کامل سند، داده‌های سرور را تازه می‌کنیم و تا پایان لودر می‌ماند
        event.preventDefault();
        event.stopPropagation();

        setShowLoader(true);
        // رفتار قبلیِ کلیکِ لینکِ همین صفحه (اسکرول به بالا) حفظ می‌شود؛
        // behavior:"instant" تا scroll-smooth ادمین آن را نرم نکند
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });

        startTransition(() => {
          router.refresh();
        });
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const routeKey = url.pathname + url.search;
      // مقصدِ قبلاً بازدیدشده فوری باز می‌شود؛ لودر فقط برای مقصدهای جدید
      setShowLoader(!visitedRoutes.has(routeKey));
      pendingRouteRef.current = routeKey;

      startTransition(() => {
        router.push(url.pathname + url.search + url.hash);
      });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  if (!isPending || !showLoader) return null;
  return <RouteLoader />;
}
