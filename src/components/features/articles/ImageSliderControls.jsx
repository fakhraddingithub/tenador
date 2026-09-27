"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdArrowForwardIos } from "react-icons/md";

import { EDGE, scrollerEdges, stepScroller } from "@/lib/sliderScroller";

/**
 * فلش‌ها و حرکتِ خودکارِ «اسلایدر تصویر».
 *
 * همان الگوی DragScroll و MergedSliderNav: جزیره‌ی کلاینتی که به ظرفِ اسکرولِ
 * *موجود* وصل می‌شود (خواهرِ خودش با data-image-slider)، چون رندرکننده‌ی بلوک‌ها
 * سروری است و نباید کلاینتی شود. مکانیکِ حرکت از sliderScroller می‌آید، پس
 * سرعت، منحنی و رفتارِ راست‌به‌چپ با بقیه‌ی اسلایدرهای سایت یکی است.
 *
 * چیزهایی که باید همین‌طور بمانند:
 *
 *  - **فلش جهتِ حرکتِ دید را نشان می‌دهد، نه شماره‌ی اسلاید.** در این سندِ
 *    راست‌به‌چپ، اسلایدِ بعدی سمتِ چپ است؛ پس فلشِ چپ «بعدی» است. همین را
 *    کاربر انتظار دارد: «آن‌طرف را نشانم بده».
 *  - **فقط یک تایمر.** بازه در یک useEffect ساخته می‌شود و با هر تغییرِ delay،
 *    هر ناوبریِ دستی و هر دخالتِ کاربر دوباره از صفر شروع می‌شود؛ پاک‌سازیِ
 *    همان effect تضمین می‌کند دو تایمر هم‌زمان اجرا نشوند.
 *  - **کلیکِ پیاپی حالت را خراب نمی‌کند.** animateScroll حرکتِ قبلی را با
 *    cancelAnimationFrame لغو می‌کند و از *موقعیتِ فعلی* شروع می‌کند.
 *  - **در انتها به ابتدا برمی‌گردد** (loop)، همان کاری که Swiper می‌کند.
 *  - **با prefers-reduced-motion اصلاً شروع نمی‌شود.**
 *  - اسکرول و کشیدن با ماوس دستِ DragScroll است؛ اینجا فقط scrollLeft نوشته می‌شود.
 */
export default function ImageSliderControls({ delay = 5000 }) {
  const anchor = useRef(null);
  const frame = useRef(0);
  const [edges, setEdges] = useState({ scrolls: false, atStart: true, atEnd: false });
  // با هر دخالتِ دستی عوض می‌شود تا بازه‌ی حرکتِ خودکار از نو شروع شود.
  const [restart, setRestart] = useState(0);

  const scrollerOf = () => anchor.current?.parentElement?.querySelector("[data-image-slider]") || null;

  useEffect(() => {
    const scroller = scrollerOf();
    if (!scroller) return undefined;
    const measure = () => setEdges(scrollerEdges(scroller));
    measure();
    const bump = () => setRestart((value) => value + 1);
    scroller.addEventListener("scroll", measure, { passive: true });
    scroller.addEventListener("pointerdown", bump, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    for (const child of scroller.children) observer.observe(child);
    const current = frame;
    return () => {
      scroller.removeEventListener("scroll", measure);
      scroller.removeEventListener("pointerdown", bump);
      observer.disconnect();
      cancelAnimationFrame(current.current);
    };
  }, []);

  const step = useCallback((direction) => {
    setRestart((value) => value + 1);
    stepScroller(scrollerOf(), direction, frame, { loop: true });
  }, []);

  useEffect(() => {
    if (!edges.scrolls || !delay) return undefined;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => stepScroller(scrollerOf(), 1, frame, { loop: true }), delay);
    return () => clearInterval(timer);
  }, [edges.scrolls, delay, restart]);

  // پیش از اندازه‌گیری هم لنگر باید در DOM باشد، وگرنه راهی به ظرف نیست.
  if (!edges.scrolls) return <span ref={anchor} hidden />;
  const button = "absolute top-1/2 z-10 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:h-11 md:w-11";
  return <span ref={anchor} className="contents">
    {/* در RTL اسلایدِ بعدی سمتِ چپ است؛ فلش جهتِ حرکت را نشان می‌دهد. */}
    <button type="button" onClick={() => step(1)} aria-label="اسلاید بعدی" className={`${button} left-2 md:left-4`}>
      <MdArrowForwardIos aria-hidden="true" className="rotate-180 text-base md:text-lg" />
    </button>
    <button type="button" onClick={() => step(-1)} aria-label="اسلاید قبلی" className={`${button} right-2 md:right-4`}>
      <MdArrowForwardIos aria-hidden="true" className="text-base md:text-lg" />
    </button>
  </span>;
}

export { EDGE };
