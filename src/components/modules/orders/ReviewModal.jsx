"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import RatingStars from "@/components/reviews/RatingStars";

const MIN_TEXT = 3;
const MAX_TEXT = 1000;

/**
 * مودال ثبت نظر از مسیر سفارش — orderId و product را به API می‌فرستد تا
 * نظر به‌عنوان «خرید تأییدشده» ثبت شود.
 *
 * props:
 *   order    — سفارش مرتبط
 *   product  — { _id, name, mainImage }
 *   onClose  — بستن مودال
 *   onDone   — (productId) پس از ثبت موفق، برای پنهان‌کردن دکمه
 */
export default function ReviewModal({ order, product, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedLen = text.trim().length;
  const valid = trimmedLen >= MIN_TEXT && trimmedLen <= MAX_TEXT;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product: product._id,
          orderId: order._id,
          text: text.trim(),
          rating: rating || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success(data.message || "نظر شما ثبت شد");
        onDone?.(String(product._id));
        onClose();
      } else if (res.status === 409) {
        toast.info("شما قبلاً برای این محصول نظر ثبت کرده‌اید");
        onDone?.(String(product._id));
        onClose();
      } else {
        toast.error(data.message || "خطا در ثبت نظر");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="ثبت نظر برای محصول"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-[#aa4725] px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <FaCheckCircle className="text-sm text-white/80" />
              <p className="text-sm font-bold">ثبت نظر</p>
            </div>
            <button
              onClick={onClose}
              aria-label="بستن"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {/* محصول */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              {product.mainImage && (
                <img
                  src={product.mainImage}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded-lg border border-gray-100 object-cover"
                />
              )}
              <p className="line-clamp-2 text-sm font-bold text-[#1a1a1a]">
                {product.name}
              </p>
            </div>

            {/* امتیاز */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">امتیاز شما:</span>
              <RatingStars value={rating} onChange={setRating} size={24} />
            </div>

            {/* متن */}
            <div>
              <label htmlFor="order-review-text" className="sr-only">
                متن نظر
              </label>
              <textarea
                id="order-review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_TEXT}
                rows={4}
                placeholder="تجربه‌ی خود از این محصول را بنویسید…"
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm leading-relaxed text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#aa4725]/40 focus:bg-white focus:ring-2 focus:ring-[#aa4725]/15"
              />
              <div className="mt-1 text-left text-[11px] text-gray-400 tabular-nums">
                {trimmedLen}/{MAX_TEXT}
              </div>
            </div>

            <button
              type="submit"
              disabled={!valid || submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#aa4725] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#933d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {submitting ? "در حال ثبت…" : "ثبت نظر"}
            </button>
            <p className="text-center text-[11px] text-gray-400">
              نظر شما پس از تأیید مدیر نمایش داده می‌شود.
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
