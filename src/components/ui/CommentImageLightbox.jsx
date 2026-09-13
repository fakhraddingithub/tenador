"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";

/**
 * پیش‌نمایش بزرگِ تصویرِ یک نظر.
 *
 * پیش‌تر همین مارک‌آپ کلمه‌به‌کلمه در پنل ادمین و در بخشِ تجربه‌های دست دوم
 * تکرار شده بود؛ حالا یک نسخه است و صفحه‌ی محصول هم از همین استفاده می‌کند.
 *
 * `object-contain` با max-h/max-w یعنی هر نسبتِ تصویری — پانوراما یا عمودیِ
 * بلند — کامل و بدون بریدگی دیده می‌شود و از کادر بیرون نمی‌زند.
 *
 * props:
 *   src     — آدرس تصویر، یا null/undefined برای بسته‌بودن
 *   onClose — بستن
 *   alt     — متن جایگزین
 */
export default function CommentImageLightbox({
  src,
  onClose,
  alt = "تصویر بزرگ نظر",
}) {
  // Escape راهِ خروجِ همیشگیِ یک لایه‌ی تمام‌صفحه است؛ بدون آن روی دسکتاپ
  // تنها راه، کلیک روی دکمه است.
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [src, onClose]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
              aria-label="بستن تصویر"
            >
              <FaTimes />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
