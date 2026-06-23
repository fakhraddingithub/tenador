"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * ZoomableImage — تصویری که با کلیک در لایت‌باکسِ تمام‌صفحه باز می‌شود.
 * بستن: دکمه‌ی ✕ ، کلیک روی پس‌زمینه، یا کلید Escape.
 * با prefers-reduced-motion، انیمیشن‌ها حذف می‌شوند.
 */
export default function ZoomableImage({ src, alt = "", className = "" }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  // بستن با Escape + قفل اسکرولِ صفحه هنگام باز بودن
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="بزرگ‌نمایی تصویر"
        className="block w-full cursor-zoom-in focus:outline-none"
      >
        <img src={src} alt={alt} className={className} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن"
              className="absolute top-4 left-4 w-11 h-11 flex items-center justify-center rounded-[6px] bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={22} />
            </button>

            <motion.img
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              initial={reduce ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-full max-h-[90vh] object-contain rounded-[6px] shadow-2xl cursor-default"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
