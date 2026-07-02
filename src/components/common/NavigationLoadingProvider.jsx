"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import RouteLoader from "@/components/common/RouteLoader";

function shouldShowLoaderForClick(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }

  const anchor = event.target?.closest?.("a[href]");
  if (!anchor) return false;
  if (anchor.dataset.routeLoader === "off") return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  let targetUrl;
  try {
    targetUrl = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (targetUrl.origin !== window.location.origin) return false;
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  return (
    targetUrl.pathname !== currentUrl.pathname ||
    targetUrl.search !== currentUrl.search
  );
}

function NavigationLoadingEvents({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname}?${searchParams?.toString() || ""}`,
    [pathname, searchParams]
  );
  const previousRouteKey = useRef(routeKey);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (previousRouteKey.current !== routeKey) {
      previousRouteKey.current = routeKey;
      setIsNavigating(false);
    }
  }, [routeKey]);

  useEffect(() => {
    const showAfterClickSettles = (event) => {
      window.setTimeout(() => {
        if (shouldShowLoaderForClick(event)) setIsNavigating(true);
      }, 0);
    };

    const showForHistoryNavigation = () => setIsNavigating(true);
    const hideOnPageRestore = () => setIsNavigating(false);

    document.addEventListener("click", showAfterClickSettles, true);
    window.addEventListener("popstate", showForHistoryNavigation);
    window.addEventListener("pageshow", hideOnPageRestore);

    return () => {
      document.removeEventListener("click", showAfterClickSettles, true);
      window.removeEventListener("popstate", showForHistoryNavigation);
      window.removeEventListener("pageshow", hideOnPageRestore);
    };
  }, []);

  return (
    <>
      {children}
      {isNavigating && <RouteLoader scrollOnMount={false} />}
    </>
  );
}

export default function NavigationLoadingProvider({ children }) {
  return (
    <Suspense fallback={children}>
      <NavigationLoadingEvents>{children}</NavigationLoadingEvents>
    </Suspense>
  );
}
