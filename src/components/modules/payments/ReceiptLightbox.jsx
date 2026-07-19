'use client'

/**
 * ReceiptLightbox — نمایشگرِ بزرگِ تصویرِ رسید
 *
 * از یک آرایه‌ی تصاویر پشتیبانی می‌کند و امکانِ جابه‌جایی بین آن‌ها را می‌دهد.
 * کیفیت تصویر حفظ می‌شود (object-contain، بدون تبدیلِ کیفیت‌کاهنده) و سبکِ مودال
 * با بقیه‌ی پروژه هماهنگ است. سازگار با حالت روشن و تیره.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export default function ReceiptLightbox({ images = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const count = images.length

  const goPrev = () => setIndex((i) => (i - 1 + count) % count)
  const goNext = () => setIndex((i) => (i + 1) % count)

  // ناوبری با کیبورد + قفلِ اسکرولِ پس‌زمینه
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndex((i) => (i + 1) % count) // RTL: چپ = بعدی
      else if (e.key === 'ArrowRight') setIndex((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, count])

  if (!count) return null
  const currentUrl = images[index]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        {/* بستن */}
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute top-4 left-4 w-10 h-10 bg-white/15 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition"
        >
          <X size={18} />
        </button>

        {/* شمارنده */}
        {count > 1 && (
          <span className="absolute top-5 right-5 text-white/80 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full">
            {index + 1} / {count}
          </span>
        )}

        {/* پیمایش قبلی/بعدی */}
        {count > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              aria-label="قبلی"
              className="absolute right-3 sm:right-6 w-11 h-11 bg-white/15 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition z-10"
            >
              <ChevronRight size={22} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              aria-label="بعدی"
              className="absolute left-3 sm:left-6 w-11 h-11 bg-white/15 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition z-10"
            >
              <ChevronLeft size={22} />
            </button>
          </>
        )}

        <motion.div
          key={index}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="relative max-w-3xl w-full flex flex-col items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={currentUrl}
            alt={`تصویر رسید ${index + 1}`}
            className="w-auto max-w-full max-h-[82vh] rounded-2xl shadow-2xl object-contain bg-white"
          />

          {/* دانلود / بازکردن در تب جدید — حفظِ کیفیتِ اصلی */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex items-center gap-1.5 text-white/90 hover:text-white text-xs font-semibold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition"
          >
            <Download size={14} />
            مشاهده در اندازه‌ی اصلی
          </a>
        </motion.div>

        {/* بندانگشتی‌ها */}
        {count > 1 && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[90vw] overflow-x-auto no-scrollbar px-2"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((url, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${
                  i === index
                    ? 'border-[#ffbf00] scale-105'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`بندانگشتی ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
