"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import UsedProductReviewCard from "@/components/templates/secondHands/UsedProductReviewCard";
import CommentImageLightbox from "@/components/ui/CommentImageLightbox";
import SliderShowcase, { ShowcaseTitle } from "@/components/templates/sports/SliderShowcase";
import { HOME_SLIDER_AUTOPLAY } from "@/lib/homeSlider";

import "swiper/css";

// loop برای پرکردنِ دو طرف به چند اسلاید نیاز دارد؛ فهرستِ کوتاه تکرار می‌شود
// (تکرارها برای صفحه‌خوان پنهان‌اند).
const MIN_LOOP_SLIDES = 6;
const GAP = 24;

/**
 * اسلایدرِ بلوکِ «اسلایدر نظرات» — در قابِ اسلایدرِ سری‌ها (SliderShowcase: عنوانِ
 * دورنگ، زیرعنوان، دکمه‌ها بالا-چپ) و با کارتِ نظرِ صفحه‌ی دست‌دوم.
 *
 * کارت‌ها هرگز روی هم نمی‌افتند: یا یک کارت (ظرفِ باریک‌تر از ۹۰۰px)، یا دقیقاً سه —
 * مرکز و دو کناری با یک مقیاسِ یکسان، پس فاصله‌ی دو طرف همیشه برابر است. کارتِ
 * چهارم هرگز نیمه‌دیده نمی‌شود. اندازه با عرضِ خودِ اسلایدر سنجیده می‌شود
 * (breakpointsBase: container)، پس در ستونِ مقاله یا خانه‌ی ادغام هم درست است.
 *
 *  - در این سندِ RTL «بعدی» سمتِ چپ است: کارتِ مرکز به راست می‌رود و کارتِ چپ جایش
 *    را می‌گیرد.
 *  - کلیک روی کارتِ کناری فقط آن را به مرکز می‌آورد (در فازِ capture، چون <Link>
 *    روی خودِ لنگر می‌نشیند)؛ کارتِ مرکز مثلِ صفحه‌ی دست‌دوم کار می‌کند.
 *  - حرکتِ خودکار با فاصله‌ی اسلایدرهای صفحه‌ی اصلی، روی hover مکث می‌کند، و با
 *    prefers-reduced-motion شروع نمی‌شود.
 */
export default function ReviewSlider({ reviews = [], heading = {} }) {
  const swiperRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  if (!reviews.length) return null;

  const moves = reviews.length > 1;
  // با کمتر از سه نظر، نمای سه‌تایی یک نظر را دو بار کنارِ هم نشان می‌داد.
  const threeUp = reviews.length >= 3;
  const copies = moves ? Math.ceil(MIN_LOOP_SLIDES / reviews.length) : 1;
  const slides = Array.from({ length: copies }, (_, copy) => reviews.map((review) => ({ review, copy }))).flat();

  const bringToCenter = (event) => {
    const slide = event.target.closest(".swiper-slide");
    if (!slide || slide.classList.contains("swiper-slide-active")) return;
    event.preventDefault();
    event.stopPropagation();
    swiperRef.current?.slideToLoop(Number(slide.getAttribute("data-swiper-slide-index")));
  };

  return (
    <SliderShowcase
      watermark="REVIEWS"
      title={<ShowcaseTitle highlight={heading.highlight} title={heading.title} subtitle={heading.subtitle} />}
      showNav={moves}
      onPrev={() => swiperRef.current?.slidePrev()}
      onNext={() => swiperRef.current?.slideNext()}
    >
      <div className="review-slider">
        <Swiper
          dir="rtl"
          modules={[Autoplay]}
          centeredSlides
          loop={moves}
          allowTouchMove={moves}
          grabCursor={moves}
          speed={650}
          spaceBetween={GAP}
          slidesPerView={1}
          breakpointsBase="container"
          breakpoints={threeUp ? { 900: { slidesPerView: 3 } } : undefined}
          autoplay={moves ? { delay: HOME_SLIDER_AUTOPLAY.delay, pauseOnMouseEnter: true, disableOnInteraction: false } : false}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) swiper.autoplay?.stop();
          }}
          className="!py-4"
        >
          {slides.map(({ review, copy }) => (
            <SwiperSlide key={`${review.id}-${copy}`} aria-hidden={copy > 0 || undefined} className="!h-auto">
              <div className="relative mx-auto h-full max-w-[28rem]" onClickCapture={bringToCenter}>
                <UsedProductReviewCard review={review} onOpenImage={setLightboxImage} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <CommentImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
        alt="تصویر ارسالی خریدار"
      />
    </SliderShowcase>
  );
}
