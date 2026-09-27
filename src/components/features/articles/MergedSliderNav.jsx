"use client";

import { useEffect, useRef, useState } from "react";

import HomeSliderNav from "@/components/features/home/HomeSliderNav";

/**
 * دکمه‌های عقب/جلوی بلوکِ ادغام‌شده، وقتی واقعاً اسلایدر شده است.
 *
 * همان الگوی DragScroll: جزیره‌ی کلاینتی که به ظرفِ اسکرولِ *موجود* وصل
 * می‌شود (خواهرِ خودش با data-merged-block)، چون رندرکننده‌ی بلوک‌ها سروری
 * است و نباید کلاینتی شود. دکمه‌ها همان HomeSliderNav صفحه‌ی اصلی‌اند، نه یک
 * کپیِ شبیه.
 *
 * چیزهایی که باید همین‌طور بمانند:
 *
 *  - **«پهن‌تر از صفحه» یک اندازه‌گیری است، نه یک تنظیم.** یک شبکه‌ی بدونِ fit
 *    ممکن است در عمل جا شود؛ تا scrollWidth از clientWidth بیشتر نشود هیچ
 *    دکمه‌ای رندر نمی‌شود. ResizeObserver روی ظرف *و* روی ردیفِ داخلش است، چون
 *    عرضِ محتوا هم با تصویرِ دیررس عوض می‌شود.
 *  - **یک «اسلاید» یعنی یک خانه.** عرضِ خانه‌ی اول به‌اضافه‌ی gap، تا مثلِ
 *    Swiper یک کارت جلو برود، نه یک صفحه.
 *  - **در RTL، scrollLeft از ۰ تا منفی می‌رود.** با scrollBy و علامتِ ثابت،
 *    فرمول در هر دو جهت درست است؛ مقایسه‌ها روی قدرِمطلق انجام می‌شود.
 *  - اسکرول و کشیدن با ماوس دست‌نخورده‌اند؛ این فقط scrollBy صدا می‌زند.
 */
const EDGE = 2;

export default function MergedSliderNav({ label }) {
  const anchor = useRef(null);
  const [state, setState] = useState({ scrolls: false, atStart: true, atEnd: false });

  useEffect(() => {
    const scroller = anchor.current?.parentElement?.querySelector("[data-merged-block]");
    if (!scroller) return undefined;

    const measure = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const at = Math.abs(scroller.scrollLeft);
      setState({ scrolls: max > EDGE, atStart: at <= EDGE, atEnd: at >= max - EDGE });
    };
    measure();

    scroller.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    // ردیفِ داخلی: عرضِ محتوا با بارگذاریِ تصویرها عوض می‌شود.
    for (const child of scroller.children) observer.observe(child);
    return () => {
      scroller.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  const step = (direction) => {
    const scroller = anchor.current?.parentElement?.querySelector("[data-merged-block]");
    if (!scroller) return;
    const row = [...scroller.children].find((child) => child.clientWidth > 0);
    const cell = row?.firstElementChild;
    const gap = parseFloat(getComputedStyle(row || scroller).columnGap) || 0;
    const amount = (cell?.getBoundingClientRect().width || scroller.clientWidth * 0.8) + gap;
    scroller.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  // پیش از اندازه‌گیری هم لنگر باید در DOM باشد، وگرنه راهی به ظرف نیست.
  if (!state.scrolls) return <span ref={anchor} hidden />;
  return <div ref={anchor} className="flex justify-end">
    <HomeSliderNav
      className="hidden md:flex items-center"
      label={label}
      onPrev={() => step(1)}
      onNext={() => step(-1)}
      prevDisabled={state.atStart}
      nextDisabled={state.atEnd}
    />
  </div>;
}
