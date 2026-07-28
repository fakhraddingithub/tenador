"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FaCheckCircle, FaQuoteRight, FaStar, FaTimes } from "react-icons/fa";

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function Stars({ value }) {
  if (!value) return null;

  return (
    <div
      className="flex items-center gap-0.5 text-[#ffbf00]"
      aria-label={`امتیاز ${value} از ۵`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <FaStar
          key={index}
          className={index < value ? "text-[#ffbf00]" : "text-gray-200"}
          size={13}
        />
      ))}
    </div>
  );
}

export default function UsedProductReviewsSection({ reviews = [] }) {
  const [lightboxImage, setLightboxImage] = useState(null);

  if (reviews.length === 0) return null;

  return (
    <section className="bg-white pb-20 pt-4 text-black md:pb-20 md:pt-6" dir="rtl">
      <div className="container mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        <div className="relative mb-12">
          <h2 className="text-2xl font-black leading-tight text-gray-900 md:text-4xl">
            <span className="text-[#aa4725]">تجربه‌ی خرید </span>
            <span>واقعی</span>
          </h2>
          <p className="mt-2 max-w-md border-r-2 border-[#aa4725]/20 pr-3 text-sm font-light italic text-gray-500 md:mt-4 md:border-r-4 md:pr-4 md:text-lg">
            نظر خریداران محصولات دست‌دوم
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="flex h-full flex-col rounded-xl border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(32,35,42,0.05)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {review.avatar ? (
                    <img
                      src={review.avatar}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#aa4725]/10 text-sm font-black text-[#aa4725]">
                      {review.author?.trim()?.[0] || "ت"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-900">
                      {review.author}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <FaCheckCircle />
                      خریدار تأییدشده
                    </span>
                  </div>
                </div>
                <FaQuoteRight className="flex-shrink-0 text-xl text-[#aa4725]/15" />
              </div>

              <div className="mb-3 flex items-center justify-between gap-2">
                <Stars value={review.rating} />
                <time className="text-[11px] text-gray-400">
                  {formatDate(review.createdAt)}
                </time>
              </div>

              <p className="flex-1 whitespace-pre-line text-sm leading-7 text-gray-700">
                {review.text}
              </p>

              {review.images.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {review.images.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setLightboxImage(imageUrl)}
                      className="aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]"
                      aria-label={`نمایش تصویر محصول ${index + 1}`}
                    >
                      <img
                        src={imageUrl}
                        alt={`تصویر ارسالی خریدار ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}

              <Link
                href={
                  review.product.slug
                    ? `/second-hand/${review.product.slug}`
                    : "/second-hand"
                }
                className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4"
              >
                {review.product.image && (
                  <img
                    src={review.product.image}
                    alt=""
                    className="h-9 w-9 rounded-md object-cover"
                  />
                )}
                <span className="truncate text-xs font-bold text-gray-500 transition-colors hover:text-[#aa4725]">
                  {review.product.name}
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setLightboxImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="تصویر محصول دریافت‌شده"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative max-h-[90vh] max-w-5xl"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={lightboxImage}
                alt="تصویر بزرگ ارسالی خریدار"
                className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
                aria-label="بستن تصویر"
              >
                <FaTimes />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
