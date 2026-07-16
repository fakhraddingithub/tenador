"use client";

import { useEffect, useRef } from "react";

/**
 * تشخیصِ «درگ» از «کلیک» روی اسلایدرهای drag-to-scroll.
 *
 * چرا listener روی window و در فازِ capture است؟
 *   NavigationLoader (src/components/common/NavigationLoader.jsx) کلیکِ همه‌ی
 *   لینک‌ها را روی `document` و در فازِ capture می‌قاپد و خودش router.push
 *   می‌کند. پس هیچ هندلری که پایین‌ترِ document باشد (روی خودِ اسلایدر یا
 *   onClickِ ری‌اکت) فرصتِ جلوگیری پیدا نمی‌کند — آن‌ها اصلاً اجرا نمی‌شوند،
 *   چون NavigationLoader قبل‌شان stopPropagation می‌زند.
 *   تنها نقطه‌ای که *قبل* از document capture اجرا می‌شود، window capture است.
 *   NavigationLoader خودش `if (event.defaultPrevented) return` را رعایت می‌کند،
 *   پس preventDefault در همین‌جا هم ناوبریِ برنامه‌ای و هم ناوبریِ پیش‌فرضِ
 *   مرورگر (لود کاملِ صفحه) را خنثی می‌کند.
 *
 * قرارداد: تا وقتی اشاره‌گر کمتر از `threshold` جابه‌جا شود، تعامل «کلیک» است و
 * دست‌نخورده به لینک می‌رسد؛ به‌محضِ عبور از آستانه «درگ» می‌شود و کلیکِ حاصل از
 * رها کردنِ دکمه بلعیده می‌شود. پرچم در هر pointerdown ریست می‌شود، پس کلیکِ
 * بعدی همیشه سالم است.
 */

const DEFAULT_THRESHOLD = 6;

export default function useDragClickGuard({
  threshold = DEFAULT_THRESHOLD,
  onDragStart,
  onDragMove,
  onDragEnd,
} = {}) {
  const containerRef = useRef(null);

  // هندلرها در ref نگه داشته می‌شوند تا افکتِ اصلی با هر رندر دوباره بسته/باز
  // نشود (وگرنه وسطِ درگ listenerها عوض می‌شدند). به‌روزرسانی داخلِ افکت است،
  // چون تغییرِ ref حینِ رندر مجاز نیست.
  const handlersRef = useRef(null);
  useEffect(() => {
    handlersRef.current = { onDragStart, onDragMove, onDragEnd };
  });

  const stateRef = useRef({
    pointerDown: false,
    dragging: false,
    dragged: false,
    startX: 0,
    startY: 0,
    pointerId: null,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const state = stateRef.current;

    const onPointerDown = (e) => {
      // فقط دکمه‌ی اصلیِ ماوس؛ لمس و قلم هم پشتیبانی می‌شوند.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.pointerDown = true;
      state.dragging = false;
      state.dragged = false; // هر تعاملِ تازه از حالتِ «کلیک» شروع می‌شود
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.pointerId = e.pointerId;
    };

    const onPointerMove = (e) => {
      if (!state.pointerDown || e.pointerId !== state.pointerId) return;

      if (!state.dragging) {
        // فاصله‌ی اقلیدسی: جابه‌جاییِ کوچک و اتفاقی هنوز «کلیک» است.
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        if (Math.hypot(dx, dy) < threshold) return;

        state.dragging = true;
        state.dragged = true;
        handlersRef.current?.onDragStart?.(e);
      }

      handlersRef.current?.onDragMove?.(e);
    };

    const onPointerEnd = (e) => {
      if (!state.pointerDown || e.pointerId !== state.pointerId) return;
      state.pointerDown = false;
      state.pointerId = null;
      if (!state.dragging) return;
      state.dragging = false;
      handlersRef.current?.onDragEnd?.(e);
      // `dragged` عمداً true می‌ماند تا کلیکِ بلافاصله‌بعد بلعیده شود؛
      // pointerdownِ بعدی آن را ریست می‌کند.
    };

    // جلوگیری از درگِ گوستِ تصویر/لینک توسطِ مرورگر هنگام کشیدن.
    const onDragStartNative = (e) => {
      if (state.pointerDown) e.preventDefault();
    };

    // تنها جایی که قبل از NavigationLoader اجرا می‌شود.
    const onClickCapture = (e) => {
      if (!state.dragged) return;
      state.dragged = false;
      // فقط کلیکِ داخلِ همین اسلایدر را خنثی کن، نه کلیکِ بقیه‌ی صفحه را.
      const el = containerRef.current;
      if (!el || !e.target || !el.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("dragstart", onDragStartNative);
    // روی window تا حرکت/رها کردن بیرون از کادر هم دیده شود.
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("click", onClickCapture, true);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("dragstart", onDragStartNative);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, [threshold]);

  return containerRef;
}
