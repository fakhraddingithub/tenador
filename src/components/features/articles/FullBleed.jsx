"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * محتوا را از ستونِ مقاله/بروشور بیرون می‌کشد تا لبه‌به‌لبه‌ی صفحه بنشیند.
 *
 * ستونِ مقاله کنارِ نوارِ کناری است و وسطِ پنجره نیست، پس ترفندِ CSSیِ
 * `calc(50% - 50vw)` جای اشتباهی می‌نشست. به‌جایش فاصله‌ی واقعیِ دو لبه اندازه
 * گرفته و با margin منفی جبران می‌شود. مرز، نزدیک‌ترین `[data-bleed-root]` است
 * (بومِ پیش‌نمایشِ ادمین — وگرنه روی منوی پنل می‌افتاد) و در غیرِ این صورت
 * پنجره، بدونِ اسکرول‌بار (`clientWidth`، نه `100vw` که اسکرولِ افقی می‌ساخت).
 */
export default function FullBleed({ children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const root = element.parentElement.closest("[data-bleed-root]");
    const place = () => {
      const edge = root ? root.getBoundingClientRect() : { left: 0, right: document.documentElement.clientWidth };
      element.style.marginLeft = element.style.marginRight = "0px";
      const box = element.getBoundingClientRect();
      element.style.marginLeft = `${edge.left - box.left}px`;
      element.style.marginRight = `${box.right - edge.right}px`;
    };
    place();
    // ستون (نوارِ کناری، چرخشِ گوشی) یا مرز (اسکرول‌بار، حالتِ موبایلِ پیش‌نمایش) که عوض شود.
    const observer = new ResizeObserver(place);
    observer.observe(element.parentElement);
    observer.observe(root || document.documentElement);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
