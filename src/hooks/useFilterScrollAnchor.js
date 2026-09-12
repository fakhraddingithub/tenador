"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { getFilterScrollTarget } from "@/lib/filterScrollPosition";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const FIXED_NAV_OFFSET = 90;
let pendingNavigation = null;

function snapshot(element) {
  const y = window.scrollY;
  const rect = element.getBoundingClientRect();
  return { y, top: rect.top + y, bottom: rect.bottom + y };
}

// Attribute filters navigate to a new keyed listing. Carry only this explicit
// filter navigation across the remount; normal navigation/back keeps its scroll.
export function prepareFilterScrollNavigation(href) {
  const element = document.querySelector("[data-filter-scroll-anchor]");
  if (!element) return;
  pendingNavigation = {
    href: new URL(href, window.location.href).href,
    expires: Date.now() + 30000,
    position: snapshot(element),
  };
}

/** Preserve the viewport on filter commits, independently of result count. */
export default function useFilterScrollAnchor(anchorRef, signal) {
  const previous = useRef(null);
  const lastSignal = useRef(signal);
  const initialized = useRef(false);

  useIsoLayoutEffect(() => {
    const element = anchorRef.current;
    if (!element) return;
    const remember = () => { previous.current = snapshot(element); };
    // Record while the OLD layout still exists, rather than reading scrollY
    // after the browser has already clamped it to a shorter document.
    remember();
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [anchorRef]);

  useIsoLayoutEffect(() => {
    const element = anchorRef.current;
    if (!element) return;
    let before = previous.current;
    const first = !initialized.current;
    initialized.current = true;
    const changed = !Object.is(lastSignal.current, signal);
    lastSignal.current = signal;

    if (first && pendingNavigation) {
      const pending = pendingNavigation;
      pendingNavigation = null;
      if (pending.href === window.location.href && pending.expires > Date.now()) {
        before = pending.position;
      } else {
        return;
      }
    } else if (!changed) {
      return;
    }

    const y = window.scrollY;
    const container = element.getBoundingClientRect();
    // All listing variants have a main column. Its bottom, not a taller
    // sidebar or footer, tells us whether results remain in the viewport.
    const main = element.querySelector("main") || element;
    const results = main.getBoundingClientRect();
    // Flex stretch can make <main> as tall as the sidebar even with no results.
    const visibleChildren = Array.from(main.children)
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.height > 0);
    const resultsBottom = visibleChildren.length
      ? Math.max(...visibleChildren.map((rect) => rect.bottom))
      : results.bottom;
    const target = getFilterScrollTarget(before, {
      top: container.top + y,
      resultsTop: results.top + y,
      resultsBottom: resultsBottom + y,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }, FIXED_NAV_OFFSET);
    if (target !== null && Math.abs(window.scrollY - target) > 1) {
      window.scrollTo({ top: target, behavior: "instant" });
    }
    previous.current = snapshot(element);
  }, [anchorRef, signal]);
}
