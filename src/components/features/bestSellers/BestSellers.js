"use client";

import { useState } from "react";

import { Swiper, SwiperSlide } from "swiper/react";

import { Navigation, Autoplay, Pagination } from "swiper/modules";

import { FiPlusCircle } from "react-icons/fi";

import "swiper/css";

import "swiper/css/pagination";

import ProductCard from "@/components/modules/cart/ProductCard";

import QuickViewModal from "@/components/modules/cart/QuickViewModal";

import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import HomeSliderNav from "@/components/features/home/HomeSliderNav";
import { HOME_SLIDER_AUTOPLAY, HOME_SLIDER_SPEED } from "@/lib/homeSlider";

export default function ProductSlider({
  title = "پرفروش‌ترین محصولات",

  subtitle = "محبوب‌ترین انتخاب‌های مشتریان ما",

  // واژه‌ای از عنوان که با رنگِ اصلیِ سایت متمایز می‌شود؛ پیش‌فرض همان رفتارِ
  // قبلیِ صفحه‌ی اصلی است تا هیچ استفاده‌ی موجودی تغییر نکند.
  highlight = "پرفروش‌ترین",

  products = [],

  rate,

  onToggleWishlist,
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const openQuickView = (product) => {
    setSelectedProduct(product);

    setIsModalOpen(true);
  };

  const closeQuickView = () => {
    setIsModalOpen(false);

    setSelectedProduct(null);
  };

  return (
    <section className="py-12 md:py-24 bg-[#fcfcfc] relative overflow-hidden group/section">
      {/* --- المان‌های پس‌زمینه (بهینه‌سازی شده برای موبایل) --- */}

      <div className="absolute top-[-5%] left-[-5%] w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[60px] md:blur-[100px] pointer-events-none" />

      <div className="absolute top-10 left-5 text-[10rem] md:text-[15rem] font-black text-gray-200/10 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        TENADOR
      </div>

      <div className="container mx-auto px-4 md:px-12 lg:px-16 xl:px-20 relative z-10">
        {/* هدر */}

        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <HomeSectionHeading title={title} highlight={highlight} subtitle={subtitle} />

          {/* کنترلرهای ناوبری (مخفی در موبایل برای تمیزی بیشتر، نمایش در تبلت به بالا) */}

          <HomeSliderNav prevClass="product-prev-btn" nextClass="product-next-btn" />
        </div>

        {/* اسلایدر */}

        <div className="relative md:px-4 lg:px-8 xl:px-20">
          <Swiper
            modules={[Navigation, Autoplay, Pagination]}
            spaceBetween={12}
            slidesPerView={2}
            centeredSlides={false}
            watchOverflow={true}
            speed={HOME_SLIDER_SPEED}
            autoplay={{ ...HOME_SLIDER_AUTOPLAY }}
            navigation={{
              nextEl: ".product-next-btn",

              prevEl: ".product-prev-btn",
            }}
            pagination={{
              el: ".slider-pagination",
              clickable: true,
              bulletClass: "swiper-pagination-bullet",
              bulletActiveClass: "swiper-pagination-bullet-active",
            }}
            breakpoints={{
              640: {
                slidesPerView: 2.5,

                spaceBetween: 16,
              },

              768: {
                slidesPerView: 3,

                spaceBetween: 18,
              },

              1024: {
                slidesPerView: 4,

                spaceBetween: 20,
              },

              1400: {
                slidesPerView: 4,

                spaceBetween: 24,
              },
            }}
            className="overflow-hidden"
          >
            {products.map((product, index) => (
              <SwiperSlide key={product._id || index} className="h-auto pb-12">
                <div className="h-full hover:-translate-y-1.5 transition-transform duration-500">
                  <ProductCard
                    product={product}
                    rate={rate}
                    isWishlisted={product.isWishlisted}
                    onQuickView={() => openQuickView(product)}
                    onToggleWishlist={() => onToggleWishlist?.(product)}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* بخش زیر اسلایدر: پیجینیشن و دکمه کاتالوگ */}

          <div className="flex flex-row items-center justify-between gap-3 md:gap-6 mt-6">
            <div className="slider-pagination !w-auto flex md:gap-2" />

            <Link
              href="/products"
              className="group flex items-center gap-2 bg-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 w-full sm:w-auto justify-center"
            >
              مشاهده کاتالوگ محصولات
              <FiPlusCircle className="text-lg md:text-xl group-hover:rotate-180 transition-transform duration-500" />
            </Link>
          </div>
        </div>
      </div>

      <QuickViewModal
        product={selectedProduct}
        rate={rate}
        isOpen={isModalOpen}
        onClose={closeQuickView}
        onToggleWishlist={() => onToggleWishlist?.(selectedProduct)}
        isWishlisted={selectedProduct?.isWishlisted}
      />
    </section>
  );
}
