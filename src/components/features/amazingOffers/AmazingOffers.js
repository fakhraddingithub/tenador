'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay, Pagination } from 'swiper/modules';
import { FiArrowLeft, FiArrowRight, FiPlusCircle } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/pagination';
import ProductCard from "@/components/modules/cart/ProductCard";
import Link from 'next/link';

export default function ProductSlider({ 
  title = "پیشنهادهای شگفت انگیز", 
  subtitle = "محبوب‌ترین انتخاب‌های مشتریان ما", 
  products = [],
  openQuickView,
  onAddToCart,
  onToggleWishlist
}) {
  return (
    <section className="py-24 bg-[#fcfcfc] relative overflow-hidden group/section">
      
      {/* --- المان‌های پس‌زمینه خلاقانه --- */}
      {/* ۱. دایره‌های نوری محو (Blobs) */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#aa4725]/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[5%] w-[300px] h-[300px] bg-[#aa4725]/8 rounded-full blur-[80px] pointer-events-none"></div>
      
      {/* ۲. متن بزرگ متحرک یا ثابت در پس‌زمینه */}
      <div className="absolute top-20 left-10 text-[15rem] font-black text-gray-200/20 select-none pointer-events-none z-0 tracking-tighter uppercase italic leading-none whitespace-nowrap">
        TENADOR
      </div>

      {/* ۳. پترن نقطه‌ای (Dot Pattern) ملایم */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23aa4725' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3C/g%3E%3C/svg%3E")` }}>
      </div>
      {/* ---------------------------------- */}

      <div className="container mx-auto px-4 relative z-10">
        {/* هدر بخش */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-20">
          <div className="relative">
            <h2 className="text-4xl lg:text-4xl font-black text-gray-900 leading-tight">
              {title.split(' ').map((word, i) => (
                <span key={i} className={word === "پیشنهادهای" ? "text-[#aa4725]" : ""}>{word} </span>
              ))}
            </h2>
            <p className="text-gray-500 mt-4 text-lg font-light max-w-md border-r-4 border-[#aa4725]/20 pr-4 italic">
              {subtitle}
            </p>
          </div>

          {/* کنترلرهای ناوبری */}
          <div className="flex items-center mt-8 md:mt-0">
            <div className="flex bg-white/80 backdrop-blur-md shadow-2xl shadow-black/5 rounded-[16px] p-1.5 border border-white/50">
              <button className="product-prev-btn w-14 h-14 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowRight size={26} />
              </button>
              <div className="w-[1px] h-8 bg-gray-100 self-center mx-1"></div>
              <button className="product-next-btn w-14 h-14 flex items-center justify-center text-gray-400 hover:text-[#aa4725] hover:bg-[#aa4725]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowLeft size={26} />
              </button>
            </div>
          </div>
        </div>

        {/* اسلایدر محصولات */}
        <div className="relative">
          <Swiper
            modules={[Navigation, Autoplay, Pagination]}
            spaceBetween={28}
            slidesPerView={1.2}
            autoplay={{ delay: 5000, disableOnInteraction: true }}
            navigation={{ nextEl: '.product-next-btn', prevEl: '.product-prev-btn' }}
            pagination={{ el: '.slider-pagination', clickable: true }}
            breakpoints={{
              640: { slidesPerView: 2.2 },
              1024: { slidesPerView: 3.5 },
              1280: { slidesPerView: 4.5 },
            }}
            className="!overflow-visible"
          >
            {products.map((product, index) => (
              <SwiperSlide key={product._id || index} className="h-auto pb-14">
                <div className="h-full hover:-translate-y-2 transition-transform duration-500">
                  <ProductCard
                    product={product}
                    isWishlisted={product.isWishlisted}
                    onQuickView={() => openQuickView?.(product)}
                    onAddToCart={() => onAddToCart?.(product)}
                    onToggleWishlist={() => onToggleWishlist?.(product)}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* پیجینیشن و لینک پایین */}
          <div className="flex items-center justify-between mt-6">
            <div className="slider-pagination !w-auto flex gap-2"></div>
            
            <Link href="/products" className="group flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-sm hover:bg-[#aa4725] hover:text-white transition-all duration-300">
              مشاهده کاتالوگ محصولات
              <FiPlusCircle className="text-xl group-hover:rotate-180 transition-transform duration-500" />
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .slider-pagination .swiper-pagination-bullet {
          width: 10px;
          height: 10px;
          background: #e2e8f0;
          opacity: 1;
          transition: all 0.4s ease;
        }
        .slider-pagination .swiper-pagination-bullet-active {
          width: 35px;
          border-radius: 5px;
          background: #aa4725;
        }
      `}</style>
    </section>
  );
}