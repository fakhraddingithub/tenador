"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import RouteLoader from "./RouteLoader";

export default function NavigationLoader() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      startTransition(() => {
        router.push(url.pathname + url.search + url.hash);
      });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  if (!isPending) return null;
  return <RouteLoader />;
}
