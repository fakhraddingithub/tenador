'use client';

/**
 * src/components/features/filters/MobileFilterDrawer.jsx
 *
 * پوسته‌ی واکنش‌گرای فیلترها:
 *  - دسکتاپ (lg+): محتوای فیلتر دقیقاً مثل قبل و به‌صورت همیشه‌نمایان رندر می‌شود.
 *  - موبایل: یک دکمه‌ی «فیلترها» (با آیکن و تعداد فیلترهای فعال) نمایش داده می‌شود
 *    که با لمس آن یک bottom-sheet با انیمیشن نرم (framer-motion) باز می‌شود.
 *
 * این کامپوننت هیچ منطق فیلترینگی ندارد؛ فقط نحوه‌ی نمایش در موبایل را تغییر می‌دهد.
 * فیلترها به‌صورت زنده اعمال می‌شوند، پس «اعمال» صرفاً شیت را می‌بندد.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FaFilter, FaTimes } from 'react-icons/fa';

export default function MobileFilterDrawer({
  children,
  activeCount = 0,
  onReset,
  title = 'فیلترها',
}) {
  const [open, setOpen] = useState(false);

  // portal فقط سمت کلاینت در دسترس است؛ چون open در SSR/hydration همیشه false است
  // این بررسی برای جلوگیری از خطای document undefined کافی است (بدون state اضافه).
  const canPortal = typeof document !== 'undefined';

  // قفل اسکرول صفحه هنگام باز بودن شیت
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // بستن با کلید Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* ───── دسکتاپ: دقیقاً مثل قبل ───── */}
      <div className="hidden lg:block">{children}</div>

      {/* ───── موبایل: دکمه‌ی فیلترها ───── */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between bg-white p-4 rounded-[var(--radius,6px)] border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
        >
          <span className="flex items-center gap-2 font-bold text-[#1a1a1a]">
            <FaFilter className="text-[var(--color-primary,#aa4725)]" size={14} />
            <span>{title}</span>
          </span>
          {activeCount > 0 ? (
            <span className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold text-white bg-[var(--color-primary,#aa4725)] rounded-full">
              {activeCount.toLocaleString('fa-IR')}
            </span>
          ) : (
            <span className="text-xs font-bold text-gray-400">انتخاب فیلتر</span>
          )}
        </button>
      </div>

      {/* ───── موبایل: bottom-sheet ───── */}
      {canPortal &&
        createPortal(
          <AnimatePresence>
            {open && [
                /* Overlay */
                <motion.div
                  key="overlay"
                  className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setOpen(false)}
                />,

                /* Sheet */
                <motion.div
                  key="sheet"
                  dir="rtl"
                  className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[88vh] flex-col rounded-t-2xl bg-[#fcfcfc] shadow-2xl lg:hidden"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                >
                  {/* دستگیره */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                  </div>

                  {/* هدر */}
                  <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-gray-100">
                    <div className="flex items-center gap-2 font-bold text-[#1a1a1a]">
                      <FaFilter className="text-[var(--color-primary,#aa4725)]" size={14} />
                      <span>{title}</span>
                      {activeCount > 0 && (
                        <span className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold text-white bg-[var(--color-primary,#aa4725)] rounded-full">
                          {activeCount.toLocaleString('fa-IR')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="بستن"
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <FaTimes className="text-gray-500" />
                    </button>
                  </div>

                  {/* بدنه: محتوای فیلتر (همان فیلترهای دسکتاپ) */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

                  {/* فوتر: پاک‌کردن و اعمال */}
                  <div className="flex items-center gap-3 border-t border-gray-100 bg-white px-4 py-3">
                    {onReset && (
                      <button
                        type="button"
                        onClick={() => onReset()}
                        className="flex-1 py-3 rounded-[var(--radius,6px)] border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        پاک کردن
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex-[2] py-3 rounded-[var(--radius,6px)] bg-[var(--color-primary,#aa4725)] text-sm font-bold text-white shadow-lg hover:brightness-95 transition"
                    >
                      اعمال فیلترها
                    </button>
                  </div>
                </motion.div>,
            ]}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
