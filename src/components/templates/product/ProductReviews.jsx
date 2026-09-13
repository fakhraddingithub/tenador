"use client";

import { useState } from "react";
import Link from "next/link";
import { FiUser, FiMessageSquare, FiCornerUpLeft } from "react-icons/fi";
import { FaCheckCircle, FaExpand } from "react-icons/fa";
import { toast } from "react-toastify";
import RatingStars from "@/components/reviews/RatingStars";
import CommentImageLightbox from "@/components/ui/CommentImageLightbox";
import { useUser } from "@/components/features/auth/UserContext";

const PAGE_SIZE = 5;
const MIN_REPLY = 3;
const MAX_REPLY = 1000;

function formatDate(value) {
  if (!value) return "";
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

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <FaCheckCircle className="h-3 w-3" />
      خریدار محصول
    </span>
  );
}

/**
 * تصاویرِ یک نظر.
 *
 * grid با ستون‌های ثابتِ کوچک و `aspect-square` + `object-cover` یعنی تصویرِ
 * پانوراما یا عمودیِ بلند هم همان کادر مربعی را می‌گیرد و چیدمان را نمی‌شکند؛
 * نسبتِ واقعی در لایت‌باکس (object-contain) دیده می‌شود.
 */
function ReviewImages({ images, onOpen, small = false }) {
  if (!images?.length) return null;
  return (
    <div
      className={`mt-3 grid gap-2 ${
        small
          ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8"
          : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
      }`}
    >
      {images.map((imageUrl, index) => (
        <button
          key={`${imageUrl}-${index}`}
          type="button"
          onClick={() => onOpen(imageUrl)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]"
          aria-label={`نمایش بزرگ تصویر ${index + 1}`}
        >
          <img
            src={imageUrl}
            alt={`تصویر ارسالی خریدار ${index + 1}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <FaExpand className="text-xs" />
          </span>
        </button>
      ))}
    </div>
  );
}

function Author({ review, size = "base" }) {
  const avatarSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex ${avatarSize} flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100`}
      >
        {review.avatar ? (
          <img src={review.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <FiUser className="h-4 w-4 text-gray-400" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`font-bold text-[#1a1a1a] ${size === "sm" ? "text-xs" : "text-sm"}`}
          >
            {review.author}
          </p>
          {review.isVerifiedPurchase && <VerifiedBadge />}
        </div>
        <p className="mt-0.5 text-xs text-gray-400">{formatDate(review.createdAt)}</p>
      </div>
    </div>
  );
}

/**
 * فرمِ پاسخ به یک نظر.
 *
 * پاسخ مثل خودِ نظر «pending» ثبت می‌شود، پس بلافاصله روی صفحه ظاهر نمی‌شود؛
 * پیام موفقیت همین را می‌گوید تا کاربر فکر نکند چیزی گم شده است.
 */
function ReplyComposer({ productId, parentId, onClose }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedLen = text.trim().length;
  const valid = trimmedLen >= MIN_REPLY && trimmedLen <= MAX_REPLY;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product: productId,
          parent: parentId,
          text: text.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success(data.message || "پاسخ شما ثبت شد");
        onClose();
      } else if (res.status === 401) {
        toast.error("ابتدا وارد حساب کاربری شوید");
      } else {
        // پیام سرور برای «والد حذف شده»، «نظر تأییدنشده» و… دقیق است
        toast.error(data.message || "خطا در ثبت پاسخ");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <label htmlFor={`reply-${parentId}`} className="sr-only">
        متن پاسخ
      </label>
      <textarea
        id={`reply-${parentId}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_REPLY}
        rows={3}
        autoFocus
        placeholder="پاسخ خود را بنویسید…"
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm leading-relaxed text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#aa4725]/40 focus:bg-white focus:ring-2 focus:ring-[#aa4725]/15"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 tabular-nums">
          {trimmedLen}/{MAX_REPLY}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#aa4725] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#933d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "در حال ثبت…" : "ثبت پاسخ"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * فهرست نظرهای تأییدشده‌ی محصول + خلاصه‌ی امتیاز.
 *
 * فقط نظرهای approved از سرور می‌آیند (سرویس getApprovedReviews) و پاسخ‌های
 * تأییدشده‌ی هر نظر در `review.replies` زیرِ خودش می‌نشیند.
 */
const ProductReviews = ({
  reviews = [],
  stats = { count: 0, average: 0 },
  productId = null,
}) => {
  const { user } = useUser();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <FiMessageSquare className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-bold text-gray-600">
          هنوز نظری برای این محصول ثبت نشده است
        </p>
        <p className="text-xs text-gray-400">
          اولین نفری باشید که تجربه‌اش را به اشتراک می‌گذارد.
        </p>
      </div>
    );
  }

  const shown = reviews.slice(0, visible);

  return (
    <div className="space-y-5">
      {/* خلاصه‌ی امتیاز */}
      {stats.average > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-5 py-4">
          <div className="text-center">
            <div className="text-3xl font-extrabold leading-none text-[#1a1a1a] tabular-nums">
              {stats.average.toLocaleString("fa-IR")}
            </div>
            <div className="mt-1 text-[11px] font-medium text-gray-400">از ۵</div>
          </div>
          <div className="h-10 w-px bg-gray-200" />
          <div className="flex flex-col gap-1.5">
            <RatingStars value={stats.average} size={18} />
            <span className="text-xs text-gray-500">
              میانگین {stats.ratedCount?.toLocaleString("fa-IR")} امتیاز ·{" "}
              {stats.count.toLocaleString("fa-IR")} نظر
            </span>
          </div>
        </div>
      )}

      {/* فهرست نظرها */}
      <div className="space-y-3">
        {shown.map((review) => (
          <article
            key={review.id}
            className="rounded-xl border border-gray-100 p-4 transition-shadow duration-200 hover:shadow-sm"
          >
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <Author review={review} />
              {review.rating > 0 && <RatingStars value={review.rating} size={15} />}
            </div>

            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-700">
              {review.text}
            </p>

            <ReviewImages images={review.images} onOpen={setLightboxImage} />

            {/* پاسخ‌ها — تورفتگی و خطِ عمودی رابطه را نشان می‌دهند */}
            {review.replies?.length > 0 && (
              <div className="mt-4 space-y-3 border-r-2 border-[#aa4725]/15 pr-3 sm:pr-4">
                {review.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-lg bg-gray-50/70 p-3 sm:p-3.5"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <FiCornerUpLeft className="h-3 w-3 flex-shrink-0 text-[#aa4725]/60" />
                      <span className="text-[11px] font-bold text-gray-400">
                        پاسخ به {review.author}
                      </span>
                    </div>
                    <Author review={reply} size="sm" />
                    <p className="mt-2 whitespace-pre-line break-words text-[13px] leading-relaxed text-gray-600">
                      {reply.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ثبت پاسخ */}
            {productId &&
              (replyingTo === review.id ? (
                <ReplyComposer
                  productId={productId}
                  parentId={review.id}
                  onClose={() => setReplyingTo(null)}
                />
              ) : user ? (
                <button
                  type="button"
                  onClick={() => setReplyingTo(review.id)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-gray-400 transition-colors hover:bg-[#aa4725]/5 hover:text-[#aa4725] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/40"
                >
                  <FiCornerUpLeft className="h-3.5 w-3.5" />
                  پاسخ
                </button>
              ) : (
                <Link
                  href="/login-register"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-gray-400 transition-colors hover:text-[#aa4725]"
                >
                  <FiCornerUpLeft className="h-3.5 w-3.5" />
                  برای پاسخ وارد شوید
                </Link>
              ))}
          </article>
        ))}
      </div>

      {visible < reviews.length && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-bold text-gray-600 transition-colors hover:border-[#aa4725]/40 hover:text-[#aa4725] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/40"
          >
            نمایش نظرهای بیشتر ({(reviews.length - visible).toLocaleString("fa-IR")})
          </button>
        </div>
      )}

      <CommentImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
        alt="تصویر ارسالی خریدار"
      />
    </div>
  );
};

export default ProductReviews;
