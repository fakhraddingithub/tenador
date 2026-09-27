"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import HomeSliderNav from "@/components/features/home/HomeSliderNav";
import { HOME_SLIDER_AUTOPLAY } from "@/lib/homeSlider";
import { EDGE, scrollerEdges, stepScroller } from "@/lib/sliderScroller";

/**
 * دکمه‌های عقب/جلو و حرکتِ خودکارِ بلوکِ ادغام‌شده، وقتی واقعاً اسلایدر شده است.
 *
 * همان الگوی DragScroll: جزیره‌ی کلاینتی که به ظرفِ اسکرولِ *موجود* وصل
 * می‌شود (خواهرِ خودش با data-merged-block)، چون رندرکننده‌ی بلوک‌ها سروری
 * است و نباید کلاینتی شود. دکمه‌ها همان HomeSliderNav صفحه‌ی اصلی‌اند و
 * سرعت/فاصله‌ی حرکت از همان فایلِ مشترک می‌آید، نه یک تنظیمِ موازی.
 *
 * چیزهایی که باید همین‌طور بمانند:
 *
 *  - **بیرون از جریانِ صفحه.** ناوبری absolute است و بالای اسلایدر شناور
 *    می‌ماند — دقیقاً مثلِ صفحه‌ی اصلی که دکمه‌ها هم‌ردیفِ عنوان‌اند نه بینِ
 *    عنوان و اسلایدر. اگر یک ردیفِ عادی بود، فاصله‌ی بلوکِ بالایی تا اسلایدر
 *    را به اندازه‌ی ارتفاعِ خودش زیاد می‌کرد و دیگر قابلِ تنظیم نبود.
 *  - **«پهن‌تر از صفحه» یک اندازه‌گیری است، نه یک تنظیم.** یک شبکه‌ی بدونِ fit
 *    ممکن است در عمل جا شود؛ تا scrollWidth از clientWidth بیشتر نشود هیچ
 *    دکمه‌ای رندر نمی‌شود. ResizeObserver روی ظرف *و* روی ردیفِ داخلش است، چون
 *    عرضِ محتوا هم با تصویرِ دیررس عوض می‌شود.
 *  - **یک «اسلاید»، حرکتِ rAF، و جهتِ راست‌به‌چپ** همه از `sliderScroller`
 *    می‌آیند — همان مکانیکی که اسلایدرِ تصویر هم از آن استفاده می‌کند، تا
 *    سرعت و رفتارِ لبه‌ها بینِ دو اسلایدر از هم دور نیفتد.
 *  - **autoplay با اولین دخالتِ کاربر می‌ایستد** (disableOnInteraction صفحه‌ی
 *    اصلی)، و با prefers-reduced-motion اصلاً شروع نمی‌شود. در انتها مثلِ
 *    Swiper به ابتدا برمی‌گردد.
 *  - اسکرول و کشیدن با ماوس دست‌نخورده‌اند؛ این فقط scrollLeft می‌نویسد.
 */
export default function MergedSliderNav({ label }) {
  const anchor = useRef(null);
  const frame = useRef(0);
  const [state, setState] = useState({ scrolls: false, atStart: true, atEnd: false });
  const [stopped, setStopped] = useState(false);

  const scrollerOf = () => anchor.current?.parentElement?.querySelector("[data-merged-block]") || null;

  useEffect(() => {
    const scroller = scrollerOf();
    if (!scroller) return undefined;

    const measure = () => setState(scrollerEdges(scroller));
    measure();

    // هر دخالتِ کاربر، حرکتِ خودکار را برای همیشه می‌خواباند.
    const stop = () => setStopped(true);
    scroller.addEventListener("scroll", measure, { passive: true });
    scroller.addEventListener("pointerdown", stop, { passive: true });
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("keydown", stop);
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    // ردیفِ داخلی: عرضِ محتوا با بارگذاریِ تصویرها عوض می‌شود.
    for (const child of scroller.children) observer.observe(child);
    return () => {
      scroller.removeEventListener("scroll", measure);
      scroller.removeEventListener("pointerdown", stop);
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("keydown", stop);
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  /** ‎1 یک خانه جلو، ‎-1 یک خانه عقب، ‎0 برگشت به ابتدا (مثلِ انتهای Swiper). */
  const step = useCallback((direction) => stepScroller(scrollerOf(), direction, frame), []);

  // حرکتِ خودکار — همان delayِ صفحه‌ی اصلی، و در انتها برگشت به ابتدا.
  useEffect(() => {
    if (!state.scrolls || stopped) return undefined;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => step(state.atEnd ? 0 : 1), HOME_SLIDER_AUTOPLAY.delay);
    return () => clearInterval(timer);
  }, [state.scrolls, state.atEnd, stopped, step]);

  const press = (direction) => () => {
    if (HOME_SLIDER_AUTOPLAY.disableOnInteraction) setStopped(true);
    step(direction);
  };

  // پیش از اندازه‌گیری هم لنگر باید در DOM باشد، وگرنه راهی به ظرف نیست.
  if (!state.scrolls) return <span ref={anchor} hidden />;
  // bottom-full + mb همان فاصله‌ی سرصفحه تا اسلایدر در صفحه‌ی اصلی است؛
  // pointer-events تا ناحیه‌ی شناور جلوی کلیکِ محتوای پشتِ خودش را نگیرد.
  return <div ref={anchor} className="pointer-events-none absolute bottom-full end-0 mb-10 md:mb-16">
    <HomeSliderNav
      className="pointer-events-auto hidden md:flex items-center"
      label={label}
      onPrev={press(-1)}
      onNext={press(1)}
      prevDisabled={state.atStart}
      nextDisabled={state.atEnd}
    />
  </div>;
}
