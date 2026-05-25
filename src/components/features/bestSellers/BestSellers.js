"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";
import { FiArrowLeft, FiArrowRight, FiPlusCircle } from "react-icons/fi";
import "swiper/css";
import "swiper/css/pagination";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import Link from "next/link";

export default function ProductSlider({
  title = "پرفروش‌ترین محصولات",
  subtitle = "محبوب‌ترین انتخاب‌های مشتریان ما",
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

      <div className="container mx-auto px-4 md:px-16 lg:px-24 xl:px-40 relative z-10">
        {/* هدر */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              {title.split(" ").map((word, i) => (
                <span
                  key={i}
                  className={word === "پرفروش‌ترین" ? "text-[#aa4725]" : ""}
                >
                  {word}{" "}
                </span>
              ))}
            </h2>
            <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
              {subtitle}
            </p>
          </div>

          <div className="hidden md:flex items-center mt-8 md:mt-0">
            <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-xl p-1 border border-white/50">
              <button className="product-prev-btn w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all rounded-lg">
                <FiArrowRight size={22} />
              </button>
              <div className="w-[1px] h-6 bg-gray-100 self-center mx-1" />
              <button className="product-next-btn w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all rounded-lg">
                <FiArrowLeft size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* اسلایدر */}
        <div className="relative">
          <Swiper
            modules={[Navigation, Autoplay, Pagination]}
            spaceBetween={12}
            slidesPerView={2}
            centeredSlides={false}
            watchOverflow={true}
            autoplay={{
              delay: 5000,
              disableOnInteraction: true,
            }}
            navigation={{
              nextEl: ".product-next-btn",
              prevEl: ".product-prev-btn",
            }}
            pagination={{
              el: ".slider-pagination-1",
              clickable: true,
              // یکسان‌سازی استایل بولت‌ها با استفاده از Tailwind
              renderBullet: function (index, className) {
                return `<span class="${className} !w-2 !h-2 md:!w-2.5 md:!h-2.5 !bg-[#aa4725] !opacity-30 [&.swiper-pagination-bullet-active]:!opacity-100 !rounded-full transition-all duration-300 !mx-1 cursor-pointer inline-block"></span>`;
              },
            }}
            breakpoints={{
              640: { slidesPerView: 2.5, spaceBetween: 16 },
              768: { slidesPerView: 3, spaceBetween: 18 },
              1024: { slidesPerView: 4, spaceBetween: 20 },
              1400: { slidesPerView: 4, spaceBetween: 24 },
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

          {/* بخش زیر اسلایدر: پیجینیشن و دکمه کاتالوگ (ریسپانسیو شده برای یک ردیف) */}
          <div className="flex flex-row items-center justify-between gap-3 mt-4">
            <div className="slider-pagination-1 !w-auto flex items-center" />

            <Link
              href="/products"
              className="group flex items-center gap-1.5 md:gap-2 bg-white px-4 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-[11px] sm:text-xs md:text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300 w-auto shrink-0 justify-center"
            >
              <span className="whitespace-nowrap">مشاهده کاتالوگ</span>
              <FiPlusCircle className="text-base md:text-xl group-hover:rotate-180 transition-transform duration-500" />
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