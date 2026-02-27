'use client';

import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay, Pagination } from 'swiper/modules';
import { FiArrowLeft, FiArrowRight, FiPlusCircle } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/pagination';
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import Link from 'next/link';

export default function ProductSlider({ 
  title = "پیشنهادهای شگفت انگیز", 
  subtitle = "محبوب‌ترین انتخاب‌های مشتریان ما", 
  products = [],
  rate,
  onToggleWishlist
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
      
      {/* المان‌های پس‌زمینه بهینه شده */}
      <div className="absolute top-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
      <div className="absolute top-12 left-6 text-[8rem] md:text-[15rem] font-black text-gray-200/15 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        TENADOR
      </div>
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-0" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23aa4725' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3C/g%3E%3C/svg%3E")` }}>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* هدر اصلاح شده برای موبایل */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              {title.split(' ').map((word, i) => (
                <span key={i} className={word === "پیشنهادهای" ? "text-[#aa4725]" : ""}>{word} </span>
              ))}
            </h2>
            <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
              {subtitle}
            </p>
          </div>

          {/* ناوبری: در موبایل مخفی برای تمیزی بیشتر */}
          <div className="hidden md:flex items-center mt-8 md:mt-0">
            <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-[16px] p-1 border border-white/50">
              <button className="product-prev-btn-2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowRight size={22} />
              </button>
              <div className="w-[1px] h-6 bg-gray-100 self-center mx-1"></div>
              <button className="product-next-btn-2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowLeft size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* اسلایدر با کارت‌های کوچک‌تر */}
        <div className="relative">
          <Swiper
            modules={[Navigation, Autoplay, Pagination]}
            spaceBetween={12} 
            slidesPerView={2.1} /* نمایش ۲ کارت کامل و کمی از کارت بعدی در موبایل */
            autoplay={{ delay: 5000, disableOnInteraction: true }}
            navigation={{ nextEl: '.product-next-btn-2', prevEl: '.product-prev-btn-2' }}
            pagination={{ el: '.slider-pagination-2', clickable: true }}
            breakpoints={{
              640: { slidesPerView: 3.2, spaceBetween: 16 },
              1024: { slidesPerView: 4.5, spaceBetween: 20 },
              1280: { slidesPerView: 5.5, spaceBetween: 24 },
              1536: { slidesPerView: 6.5, spaceBetween: 24 },
            }}
            className="!overflow-visible"
          >
            {products.map((product, index) => (
              <SwiperSlide key={product._id || index} className="h-auto pb-10">
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

          {/* پیجینیشن و لینک پایین */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6">
            <div className="slider-pagination-2 !w-auto flex gap-2"></div>
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

      <style jsx global>{`
        .slider-pagination-2 .swiper-pagination-bullet {
          width: 8px;
          height: 8px;
          background: #e2e8f0;
          opacity: 1;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .slider-pagination-2 .swiper-pagination-bullet-active {
          width: 28px;
          border-radius: 4px;
          background: #aa4725;
        }
        @media (max-width: 640px) {
          .slider-pagination-2 .swiper-pagination-bullet {
            width: 6px;
            height: 6px;
          }
          .slider-pagination-2 .swiper-pagination-bullet-active {
            width: 20px;
          }
        }
      `}</style>
    </section>
  );
}