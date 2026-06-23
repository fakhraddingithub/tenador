"use client";

/**
 * GalleryImageViewer
 * ──────────────────────────────────────────────────────────────────────────
 * یک لایهٔ تعاملی قابل‌استفادهٔ مجدد روی «تصویرِ در حال نمایشِ» گالری محصول.
 * این کامپوننت چیدمان/مارکاپ موجود گالری را تغییر نمی‌دهد؛ فقط به‌صورت یک
 * overlayِ absolute روی تصویر قرار می‌گیرد و دو قابلیت اضافه می‌کند:
 *
 *   ۱) تول‌تیپِ دنبال‌کنندهٔ ماوس که متن alt تصویر (نام محصول) را نشان می‌دهد.
 *      فقط برای ماوس فعال است (روی لمسی نمایش داده نمی‌شود).
 *   ۲) با کلیک، لایت‌باکسِ تمام‌صفحه با قابلیت زوم (اسکرول، پینچ، دکمه‌ها) باز می‌شود.
 *
 * استفاده: داخل کانتینرِ «relative» تصویر اصلی، به‌عنوان آخرین فرزند قرار بگیرد.
 *   <div className="relative ...">
 *     ... <Image fill /> ...
 *     <GalleryImageViewer src={currentSrc} alt={productName} />
 *   </div>
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ════════════════════════════════════════════════════════════════════════
   لایت‌باکس — نمایشگر تمام‌صفحهٔ تصویر با زوم
   ════════════════════════════════════════════════════════════════════════ */
function ImageLightbox({ src, alt, onClose }) {
  const reduce = useReducedMotion();
  const dialogRef = useRef(null);
  const imgRef = useRef(null);

  // وضعیت تبدیل (transform): مقیاس و جابه‌جایی
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // ردیابی نشانگرها برای پن و پینچ
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const pan = useRef(null);
  const dragged = useRef(false);

  // محدودکردن جابه‌جایی تا تصویر از کادر خارج نشود
  const clampTranslate = useCallback((nx, ny, s) => {
    const el = imgRef.current;
    if (!el) return { x: nx, y: ny };
    const maxX = Math.max(0, (el.offsetWidth * (s - 1)) / 2);
    const maxY = Math.max(0, (el.offsetHeight * (s - 1)) / 2);
    return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
  }, []);

  // زوم با نقطهٔ کانونی (focal) نسبت به مرکز صفحه
  const zoomTo = useCallback(
    (nextScale, focalX = 0, focalY = 0) => {
      setView((v) => {
        const ns = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        if (ns === v.scale) return v;
        const ratio = ns / v.scale;
        const x = focalX * (1 - ratio) + v.x * ratio;
        const y = focalY * (1 - ratio) + v.y * ratio;
        const c = clampTranslate(x, y, ns);
        return { scale: ns, x: c.x, y: c.y };
      });
    },
    [clampTranslate],
  );

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  const stageCenter = () => {
    const r = dialogRef.current?.getBoundingClientRect();
    if (!r) return { cx: 0, cy: 0, rect: null };
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      rect: r,
    };
  };

  // زومِ اسکرول/ترک‌پد (zoom-to-cursor) — listener غیرفعال نیست تا preventDefault کار کند
  useEffect(() => {
    const stage = dialogRef.current;
    if (!stage) return;
    const onWheel = (e) => {
      e.preventDefault();
      const { cx, cy } = stageCenter();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomTo(viewRef.current.scale * factor, e.clientX - cx, e.clientY - cy);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  /* ── پن و پینچ با Pointer Events ── */
  const onPointerDown = (e) => {
    dialogRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    setInteracting(true);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const { cx, cy } = stageCenter();
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startScale: viewRef.current.scale,
        midX: (a.x + b.x) / 2 - cx,
        midY: (a.y + b.y) / 2 - cy,
        startX: viewRef.current.x,
        startY: viewRef.current.y,
      };
      pan.current = null;
    } else {
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        startX: viewRef.current.x,
        startY: viewRef.current.y,
      };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ns = clamp(
        pinch.current.startScale * (dist / pinch.current.dist),
        MIN_SCALE,
        MAX_SCALE,
      );
      const ratio = ns / pinch.current.startScale;
      const x = pinch.current.midX * (1 - ratio) + pinch.current.startX * ratio;
      const y = pinch.current.midY * (1 - ratio) + pinch.current.startY * ratio;
      const c = clampTranslate(x, y, ns);
      dragged.current = true;
      setView({ scale: ns, x: c.x, y: c.y });
    } else if (pan.current && pointers.current.size === 1) {
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      setView((v) => {
        if (v.scale <= 1) return v; // وقتی زوم نیست پن نکن
        const c = clampTranslate(
          pan.current.startX + dx,
          pan.current.startY + dy,
          v.scale,
        );
        return { ...v, x: c.x, y: c.y };
      });
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      pan.current = null;
      setInteracting(false);
    } else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      pan.current = {
        x: p.x,
        y: p.y,
        startX: viewRef.current.x,
        startY: viewRef.current.y,
      };
    }
  };

  const onDoubleClick = (e) => {
    const { cx, cy } = stageCenter();
    if (viewRef.current.scale > 1.01) reset();
    else zoomTo(2.5, e.clientX - cx, e.clientY - cy);
  };

  // کلیک روی پس‌زمینه (بیرونِ تصویر) → بستن. درگ‌کردن باعث بستن نشود.
  const onBackdropClick = (e) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (e.target === dialogRef.current) onClose();
  };

  /* ── Escape، قفل اسکرول بدون پرش چیدمان، تله‌ی فوکوس ── */
  useEffect(() => {
    const prevActive =
      typeof document !== "undefined" ? document.activeElement : null;
    const scrollbar =
      window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll("button:not([disabled])") || [],
      );

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const nodes = focusables();
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        const inside = dialogRef.current?.contains(active);
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);

    const raf = requestAnimationFrame(() => {
      const el =
        dialogRef.current?.querySelector("[data-autofocus]") ||
        dialogRef.current;
      el?.focus?.();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      prevActive?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const zoomed = view.scale > 1.01;
  const btn =
    "w-11 h-11 flex items-center justify-center rounded-[8px] bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return createPortal(
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "نمایش تصویر"}
      tabIndex={-1}
      dir="rtl"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={onBackdropClick}
      onDoubleClick={onDoubleClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm select-none outline-none"
      style={{ touchAction: "none" }}
    >
      {/* کنترل‌ها */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <button
          type="button"
          data-autofocus
          aria-label="بستن"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={btn}
        >
          <X size={22} />
        </button>
        <button
          type="button"
          aria-label="کوچک‌نمایی"
          onClick={(e) => {
            e.stopPropagation();
            zoomTo(viewRef.current.scale / 1.4);
          }}
          className={btn}
        >
          <ZoomOut size={20} />
        </button>
        <button
          type="button"
          aria-label="بزرگ‌نمایی"
          onClick={(e) => {
            e.stopPropagation();
            zoomTo(viewRef.current.scale * 1.4);
          }}
          className={btn}
        >
          <ZoomIn size={20} />
        </button>
        <button
          type="button"
          aria-label="بازنشانی زوم"
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          disabled={!zoomed}
          className={`${btn} ${!zoomed ? "opacity-40 cursor-default" : ""}`}
        >
          <RotateCcw size={19} />
        </button>
      </div>

      {/* تصویر — کیفیت اصلی حفظ می‌شود، فقط transform تغییر می‌کند */}
      <img
        ref={imgRef}
        src={src}
        alt={alt || ""}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] object-contain rounded-[6px] shadow-2xl will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: interacting || reduce ? "none" : "transform 150ms ease-out",
          cursor: zoomed ? "grab" : "zoom-in",
        }}
      />
    </motion.div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   GalleryImageViewer — لایهٔ تعاملی + تول‌تیپ روی تصویرِ در حال نمایش
   ════════════════════════════════════════════════════════════════════════ */
export default function GalleryImageViewer({ src, alt = "", className = "" }) {
  const layerRef = useRef(null);
  const tipRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [open, setOpen] = useState(false);

  // فقط برای ماوس (نه لمسی/قلم)
  const isMouse = (e) => !e.pointerType || e.pointerType === "mouse";

  const handleMove = (e) => {
    if (!isMouse(e)) return;
    const layer = layerRef.current;
    const tip = tipRef.current;
    if (!layer || !tip) return;
    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pad = 8; // حداقل فاصله از لبه‌های تصویر (تشخیص مرز)
    const off = 6; // فاصلهٔ بسیار کم تا نزدیک‌ترین گوشهٔ تول‌تیپ به نشانگر بچسبد
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let tx = x + off;
    let ty = y + off;
    if (tx + tw + pad > rect.width) tx = x - tw - off; // برگرداندن به چپ هنگام سرریز
    if (tx < pad) tx = pad;
    if (ty + th + pad > rect.height) ty = y - th - off;
    if (ty < pad) ty = pad;
    // مستقیماً DOM را به‌روزرسانی می‌کنیم تا از رندرِ بی‌مورد جلوگیری شود
    tip.style.transform = `translate(${tx}px, ${ty}px)`;
  };

  if (!src) return null;

  return (
    <>
      <button
        ref={layerRef}
        type="button"
        onClick={() => setOpen(true)}
        onPointerMove={handleMove}
        onPointerEnter={(e) => {
          if (isMouse(e)) setHovering(true);
        }}
        onPointerLeave={() => setHovering(false)}
        aria-label={alt ? `بزرگ‌نمایی تصویر: ${alt}` : "بزرگ‌نمایی تصویر"}
        className={`absolute inset-0 z-20 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725] focus-visible:ring-inset ${className}`}
      >
        {alt ? (
          <span
            ref={tipRef}
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 right-0 z-30 max-w-[16rem] break-words leading-snug rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white text-right shadow-lg backdrop-blur-sm transition-opacity duration-150 ${
              hovering ? "opacity-100" : "opacity-0"
            }`}
            style={{ willChange: "transform" }}
          >
            {alt}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
