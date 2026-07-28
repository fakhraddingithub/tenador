"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCheckCircle, FaCamera, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import RatingStars from "@/components/reviews/RatingStars";

const MIN_TEXT = 3;
const MAX_TEXT = 1000;
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const previewUrls = useRef(new Set());
  const isUsedProduct = product.reviewType === "used_product";

  const trimmedLen = text.trim().length;
  const valid = trimmedLen >= MIN_TEXT && trimmedLen <= MAX_TEXT;

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current.clear();
    },
    []
  );

  function addImages(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    if (images.length + selected.length > MAX_IMAGES) {
      toast.info(`حداکثر ${MAX_IMAGES.toLocaleString("fa-IR")} تصویر می‌توانید ثبت کنید`);
      return;
    }

    for (const file of selected) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("فقط تصاویر JPG، PNG و WebP مجاز هستند");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("حجم هر تصویر نباید بیشتر از ۵ مگابایت باشد");
        return;
      }
    }

    const nextImages = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview };
    });
    setImages((current) => [...current, ...nextImages]);
  }

  function removeImage(index) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      previewUrls.current.delete(current[index].preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadImages() {
    return Promise.all(
      images.map(async ({ file }) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "used-product-reviews");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.url) {
          throw new Error(result.error || "آپلود یکی از تصاویر ناموفق بود");
        }
        return result.url;
      })
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    try {
      const uploadedImages = isUsedProduct && images.length > 0
        ? await uploadImages()
        : [];
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(isUsedProduct
            ? { usedProduct: product._id }
            : { product: product._id }),
          orderId: order._id,
          text: text.trim(),
          rating: rating || undefined,
          images: uploadedImages,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success(data.message || "نظر شما ثبت شد");
        onDone?.(product.reviewKey || `product:${product._id}`);
        onClose();
      } else if (res.status === 409) {
        toast.info("شما قبلاً برای این محصول نظر ثبت کرده‌اید");
        onDone?.(product.reviewKey || `product:${product._id}`);
        onClose();
      } else {
        toast.error(data.message || "خطا در ثبت نظر");
      }
    } catch (error) {
      toast.error(error.message || "خطا در ارتباط با سرور");
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
          className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
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

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5">
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

            {isUsedProduct && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700">
                      تصاویر محصول دریافت‌شده
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      اختیاری؛ حداکثر ۴ تصویر JPG، PNG یا WebP
                    </p>
                  </div>
                  {images.length < MAX_IMAGES && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#aa4725]/25 bg-[#aa4725]/5 px-3 py-2 text-xs font-bold text-[#aa4725] transition hover:bg-[#aa4725]/10">
                      <FaCamera />
                      افزودن عکس
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        onChange={addImages}
                      />
                    </label>
                  )}
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={`${image.file.name}-${image.file.lastModified}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={image.preview}
                          alt={`تصویر انتخابی ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          aria-label="حذف تصویر"
                          className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-[10px] text-white transition hover:bg-red-600"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
