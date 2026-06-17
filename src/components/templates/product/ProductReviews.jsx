"use client";

import { useState } from "react";
import { FiUser, FiMessageSquare } from "react-icons/fi";
import { FaCheckCircle } from "react-icons/fa";
import RatingStars from "@/components/reviews/RatingStars";

const PAGE_SIZE = 5;

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
 * فهرست نظرهای تأییدشده‌ی محصول + خلاصه‌ی امتیاز.
 * فقط نظرهای approved از سرور می‌آیند (سرویس getApprovedReviews).
 */
const ProductReviews = ({ reviews = [], stats = { count: 0, average: 0 } }) => {
  const [visible, setVisible] = useState(PAGE_SIZE);

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
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  {review.avatar ? (
                    <img
                      src={review.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiUser className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[#1a1a1a]">
                      {review.author}
                    </p>
                    {review.isVerifiedPurchase && <VerifiedBadge />}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
              </div>

              {review.rating > 0 && (
                <RatingStars value={review.rating} size={15} />
              )}
            </div>

            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {review.text}
            </p>
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
    </div>
  );
};

export default ProductReviews;
