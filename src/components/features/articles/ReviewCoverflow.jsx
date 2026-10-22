"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectCoverflow } from "swiper/modules";
import UsedProductReviewCard from "@/components/templates/secondHands/UsedProductReviewCard";
import CommentImageLightbox from "@/components/ui/CommentImageLightbox";
import HomeSliderNav from "@/components/features/home/HomeSliderNav";
import { HOME_SLIDER_AUTOPLAY } from "@/lib/homeSlider";

import "swiper/css";
import "swiper/css/effect-coverflow";

// loop با slidesPerView: "auto" برای پرکردنِ دو طرف به چند اسلاید نیاز دارد؛
// فهرستِ کوتاه تکرار می‌شود (تکرارها برای صفحه‌خوان پنهان‌اند).
const MIN_LOOP_SLIDES = 6;

/**
 * اسلایدرِ کاورفلو برای بلوکِ «اسلایدر نظرات» — کارت‌ها عیناً UsedProductReviewCard.
 *
 * یک کارت در مرکز، بقیه دو طرفش با عمق: هر قدم دورتر از مرکز کوچک‌تر
 * (`scale` + `depth` ـِ coverflow) و کم‌رنگ‌تر (CSS روی .swiper-slide). در این
 * سندِ RTL «بعدی» سمتِ چپ است، پس با هر حرکت کارتِ مرکز به راست می‌رود و کارتِ
 * چپ جایش را می‌گیرد.
 *
 *  - کلیک روی کارتِ کناری فقط آن را به مرکز می‌آورد (پیوندش باز نمی‌شود)؛ کارتِ
 *    مرکز مثلِ صفحه‌ی دست‌دوم کار می‌کند — پیوندِ محصول و بزرگ‌نماییِ تصویر.
 *    کلیک در فازِ capture گرفته می‌شود، چون <Link> روی خودِ لنگر می‌نشیند.
 *  - حرکتِ خودکار با همان فاصله‌ی اسلایدرهای صفحه‌ی اصلی، روی hover مکث می‌کند،
 *    و با prefers-reduced-motion اصلاً شروع نمی‌شود.
 */
export default function ReviewCoverflow({ reviews = [] }) {
  const swiperRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  if (!reviews.length) return null;

  const moves = reviews.length > 1;
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
    <div className="review-coverflow relative">
      <Swiper
        dir="rtl"
        modules={[EffectCoverflow, Autoplay]}
        effect="coverflow"
        centeredSlides
        slidesPerView="auto"
        loop={moves}
        allowTouchMove={moves}
        grabCursor={moves}
        speed={650}
        // stretch (درصدی از عرضِ کارت) کارت‌های کناری را پشتِ کارتِ مرکز می‌کشد: لایه‌لایه،
        // و در گوشی هم کنارِ کارتِ مرکز پیدا می‌مانند، نه بیرونِ کادر.
        coverflowEffect={{ rotate: 0, stretch: "28%", depth: 140, modifier: 1, scale: 0.88, slideShadows: false }}
        autoplay={moves ? { delay: HOME_SLIDER_AUTOPLAY.delay, pauseOnMouseEnter: true, disableOnInteraction: false } : false}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) swiper.autoplay?.stop();
        }}
        className="!py-6"
      >
        {slides.map(({ review, copy }) => (
          <SwiperSlide
            key={`${review.id}-${copy}`}
            aria-hidden={copy > 0 || undefined}
            className="!h-auto !w-[min(85%,22.5rem)]"
          >
            <div className="h-full" onClickCapture={bringToCenter}>
              <UsedProductReviewCard review={review} onOpenImage={setLightboxImage} />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {moves ? (
        <HomeSliderNav
          className="hidden md:flex justify-center mt-4"
          label="جابه‌جایی میانِ نظرها"
          onPrev={() => swiperRef.current?.slidePrev()}
          onNext={() => swiperRef.current?.slideNext()}
        />
      ) : null}

      <CommentImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
        alt="تصویر ارسالی خریدار"
      />
    </div>
  );
}
