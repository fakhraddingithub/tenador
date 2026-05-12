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
  title = "پرفروش‌ترین محصولات", 
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
      
      {/* --- المان‌های پس‌زمینه (بهینه‌سازی شده برای موبایل) --- */}
      <div className="absolute top-[-5%] left-[-5%] w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-[#aa4725]/5 rounded-full blur-[60px] md:blur-[100px] pointer-events-none" />
      <div className="absolute top-10 left-5 text-[10rem] md:text-[15rem] font-black text-gray-200/10 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        TENADOR
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* هدر */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16">
          <div className="relative">
            <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
              {title.split(' ').map((word, i) => (
                <span key={i} className={word === "پرفروش‌ترین" ? "text-[#aa4725]" : ""}>{word} </span>
              ))}
            </h2>
            <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
              {subtitle}
            </p>
          </div>

          {/* کنترلرهای ناوبری (مخفی در موبایل برای تمیزی بیشتر، نمایش در تبلت به بالا) */}
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
            spaceBetween={12} /* فاصله کمتر برای کارت‌های کوچک‌تر */
            slidesPerView={2} /* نمایش دقیقاً ۲ کارت در موبایل */
            autoplay={{ delay: 5000, disableOnInteraction: true }}
            navigation={{ nextEl: '.product-next-btn', prevEl: '.product-prev-btn' }}
            pagination={{ el: '.slider-pagination', clickable: true }}
            breakpoints={{
              /* تبلت‌های کوچک: ۳.۵ کارت */
              640: { 
                slidesPerView: 3.5, 
                spaceBetween: 15 
              },
              /* لپ‌تاپ: ۵ کارت */
              1024: { 
                slidesPerView: 5, 
                spaceBetween: 20 
              },
              /* دسکتاپ بزرگ: ۶ کارت */
              1280: { 
                slidesPerView: 6, 
                spaceBetween: 20 
              },
              /* مانیتورهای خیلی بزرگ: ۷ کارت */
              1536: { 
                slidesPerView: 7, 
                spaceBetween: 25 
              },
            }}
            className="!overflow-visible"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-4">
            <div className="slider-pagination !w-auto flex gap-2" />
            
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