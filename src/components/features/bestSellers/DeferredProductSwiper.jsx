"use client";

import { useEffect, useRef } from "react";

// Keep the SSR cards and their responsive widths until Swiper takes over.
// Negative/RTL offsets are managed by Swiper only after initialization.
const pendingStyles = `
.tnd-deferred-swiper:not(.swiper-initialized){overflow-x:auto;scrollbar-width:none}
.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper{gap:12px}
.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper>.swiper-slide{width:calc((100% - 12px)/2);flex-shrink:0}
@media(min-width:640px){.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper{gap:16px}.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper>.swiper-slide{width:calc((100% - 24px)/2.5)}}
@media(min-width:768px){.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper{gap:18px}.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper>.swiper-slide{width:calc((100% - 36px)/3)}}
@media(min-width:1024px){.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper{gap:20px}.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper>.swiper-slide{width:calc((100% - 60px)/4)}}
@media(min-width:1400px){.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper{gap:24px}.tnd-deferred-swiper:not(.swiper-initialized)>.swiper-wrapper>.swiper-slide{width:calc((100% - 72px)/4)}}`;

export default function DeferredProductSwiper({ children, className, ...options }) {
  const elementRef = useRef(null);
  const swiperRef = useRef(null);
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { swiperRef.current?.update(); }, [children]);
  useEffect(() => {
    const element = elementRef.current;
    let cancelled = false, loading = false, swiper;
    let observer;
    let pendingSteps = 0;
    const section = element.closest("section");
    const next = section?.querySelector(optionsRef.current.navigation?.nextEl);
    const previous = section?.querySelector(optionsRef.current.navigation?.prevEl);
    const activate = async () => {
      if (loading || swiper || cancelled) return;
      loading = true;
      try {
        const [{ default: Swiper }, { Navigation, Autoplay, Pagination }] = await Promise.all([import("swiper"), import("swiper/modules")]);
        if (cancelled) return;
        swiper = new Swiper(element, { ...optionsRef.current, modules: [Navigation, Autoplay, Pagination] });
        swiperRef.current = swiper;
        while (pendingSteps > 0) { swiper.slideNext(); pendingSteps--; }
        while (pendingSteps < 0) { swiper.slidePrev(); pendingSteps++; }
        observer?.disconnect();
      } catch (error) {
        // Native scrolling and all card links remain usable if the chunk fails.
        console.error("Related slider could not initialize", error);
      } finally { loading = false; }
    };
    if (typeof IntersectionObserver === "undefined") activate();
    else {
      observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) activate(); }, { rootMargin: "400px" });
      observer.observe(element);
    }
    element.addEventListener("pointerdown", activate, { passive: true });
    element.addEventListener("focusin", activate);
    const queueNext = () => { if (!swiper) { pendingSteps++; activate(); } };
    const queuePrevious = () => { if (!swiper) { pendingSteps--; activate(); } };
    next?.addEventListener("click", queueNext);
    previous?.addEventListener("click", queuePrevious);
    return () => {
      cancelled = true;
      observer?.disconnect();
      element.removeEventListener("pointerdown", activate);
      element.removeEventListener("focusin", activate);
      next?.removeEventListener("click", queueNext);
      previous?.removeEventListener("click", queuePrevious);
      swiper?.destroy(true, true);
      swiperRef.current = null;
    };
  }, []);
  return <><style>{pendingStyles}</style><div ref={elementRef} className={`swiper tnd-deferred-swiper ${className || ""}`}><div className="swiper-wrapper">{children}</div></div></>;
}
