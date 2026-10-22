"use client";

import { useState } from "react";
import CommentImageLightbox from "@/components/ui/CommentImageLightbox";
import UsedProductReviewCard from "./UsedProductReviewCard";

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
            نظر خریداران محصولات دست دوم
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <UsedProductReviewCard key={review.id} review={review} onOpenImage={setLightboxImage} />
          ))}
        </div>
      </div>

      <CommentImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
        alt="تصویر ارسالی خریدار"
      />
    </section>
  );
}
