"use client";

import { useEffect, useRef } from "react";

/**
 * کشیدن با ماوس برای اسکرولِ افقی — روی *همان* ظرفِ اسکرول‌دارِ موجود.
 *
 * یک جزیره‌ی کلاینتیِ نامرئی است که به `parentElement` خودش وصل می‌شود، چون
 * رندرکننده‌ی بلوک‌ها سروری است و نباید کلاینتی شود (sanitize-html در باندلِ
 * مرورگر). هیچ مارک‌آپی عوض نمی‌شود و اسکرول‌بارِ بومی دست‌نخورده می‌ماند.
 *
 * قاعده‌ها، هر کدام برای یک تله‌ی واقعی:
 *
 *  - **فقط ماوس.** روی لمس، اسکرولِ بومی از قبل کار می‌کند و دست‌بردن در آن
 *    فقط حرکت را سنگین می‌کند.
 *  - **آستانه‌ی ۵ پیکسل.** زیرِ آن هنوز «کلیک» است، پس پیوند/دکمه عادی کار
 *    می‌کند؛ بالای آن «کشیدن» است و کلیکِ پس از آن بلعیده می‌شود تا پیوند باز
 *    نشود. کلیک در فازِ capture گرفته می‌شود، چون <Link> نکست روی خودِ لنگر
 *    می‌نشیند و در فازِ bubble دیر است.
 *  - **انتخابِ متن خاموش می‌شود فقط وقتی کشیدن شروع شد** (نه روی هر
 *    mousedown)، وگرنه فوکوسِ فیلدها و انتخابِ عمدیِ متن از بین می‌رفت.
 *  - **snap موقتاً خاموش.** با scroll-snap: mandatory، هر نوشتنِ scrollLeft
 *    بی‌درنگ به نزدیک‌ترین نقطه می‌پرد و کشیدن تکه‌تکه می‌شود؛ در پایان دوباره
 *    روشن می‌شود و ظرف خودش به نقطه‌ی درست می‌نشیند.
 *  - **نوارِ اسکرول استثناست.** کلیک روی خودِ نوار نباید «کشیدن» حساب شود.
 */

const DRAG_THRESHOLD = 5;
// جایی که کاربر واقعاً می‌خواهد متن انتخاب کند یا با کنترل کار کند.
const HANDS_OFF = "input, textarea, select, [contenteditable], [data-drag-handle], [data-edit-block]";

export default function DragScroll() {
  const anchor = useRef(null);

  useEffect(() => {
    const element = anchor.current?.parentElement;
    if (!element) return undefined;

    const scrollable = () => element.scrollWidth - element.clientWidth > 1;
    const sync = () => element.classList.toggle("drag-scroll", scrollable());
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(element);

    let state = null;
    let swallowClick = false;

    const stop = () => {
      element.classList.remove("drag-scroll--active");
      if (state?.captured) element.releasePointerCapture?.(state.id);
      state = null;
    };

    const onPointerDown = (event) => {
      swallowClick = false;
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (!scrollable() || event.target.closest?.(HANDS_OFF)) return;
      // نوارِ اسکرولِ افقی زیرِ ناحیه‌ی محتواست؛ کلیک روی آن کارِ خودش را بکند.
      if (event.clientY > element.getBoundingClientRect().top + element.clientHeight) return;
      state = { id: event.pointerId, x: event.clientX, left: element.scrollLeft, dragging: false, captured: false };
    };

    const onPointerMove = (event) => {
      if (!state || event.pointerId !== state.id) return;
      const dx = event.clientX - state.x;
      if (!state.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        state.dragging = true;
        element.classList.add("drag-scroll--active");
        try { element.setPointerCapture(state.id); state.captured = true; } catch { /* ناچیز */ }
        window.getSelection?.()?.removeAllRanges();
      }
      event.preventDefault();
      // حسابِ دلتا، نه مقدارِ مطلق: در RTL علامتِ scrollLeft فرق دارد و این
      // فرمول در هر دو جهت درست است.
      element.scrollLeft = state.left - dx;
    };

    const onPointerUp = () => {
      if (!state) return;
      swallowClick = state.dragging;
      stop();
    };

    const onClickCapture = (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    // کشیدن نباید با drag-and-dropِ بومیِ تصویر/متن قاطی شود.
    const onDragStart = (event) => { if (state?.dragging) event.preventDefault(); };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("click", onClickCapture, true);
    element.addEventListener("dragstart", onDragStart);

    return () => {
      observer.disconnect();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("click", onClickCapture, true);
      element.removeEventListener("dragstart", onDragStart);
      element.classList.remove("drag-scroll", "drag-scroll--active");
    };
  }, []);

  // display:none — نه جایی در شبکه می‌گیرد نه چیزی را جابه‌جا می‌کند.
  return <span ref={anchor} hidden aria-hidden="true" />;
}
