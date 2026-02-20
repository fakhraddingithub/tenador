"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { motion } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import Link from "next/link";

// Styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export default function Hero({ slides = [] }) {
  return (
    <section className="relative w-full h-[450px] md:h-[550px] lg:h-[650px] overflow-hidden bg-[#0d0d0d] group">
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        spaceBetween={0}
        slidesPerView={1}
        loop={true}
        speed={800}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        navigation={{
          nextEl: ".hero-next-btn",
          prevEl: ".hero-prev-btn",
        }}
        pagination={{
          clickable: true,
          el: ".hero-custom-pagination",
          bulletClass: "swiper-pagination-bullet",
          bulletActiveClass: "swiper-pagination-bullet-active",
        }}
        className="h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            {({ isActive }) => (
              <Link
                href={slide.link || "#"}
                className="block relative w-full h-full cursor-pointer"
              >
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d]/60 via-transparent to-transparent z-10" />
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out"
                    style={{ transform: isActive ? "scale(1.08)" : "scale(1)" }}
                  />
                </div>

                {/* Content Overlay */}
                <div className="relative z-20 container mx-auto px-12 md:px-20 h-full flex items-center">
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={isActive ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="max-w-4xl text-right"
                  >
                    <h2
                      className="text-4xl md:text-4xl lg:text-7xl font-bold text-white mb-6 leading-tight"
                      style={{
                        textShadow:
                          "2px 2px 10px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.2)",
                      }}
                    >
                      {slide.title}
                    </h2>
                    <p
                      className="text-base md:text-xl lg:text-2xl text-gray-100 max-w-2xl leading-relaxed line-clamp-2 md:line-clamp-none"
                      style={{ textShadow: "1px 1px 5px rgba(0,0,0,0.5)" }}
                    >
                      {slide.subtitle}
                    </p>
                  </motion.div>
                </div>
              </Link>
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Side Navigation Buttons */}
      <button className="hero-prev-btn absolute top-1/2 right-4 -translate-y-1/2 z-30 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full border border-white/20 bg-black/10 backdrop-blur-md text-white hover:bg-[#aa4725] hover:border-[#aa4725] transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 cursor-pointer shadow-xl">
        <FiChevronRight size={32} />
      </button>

      <button className="hero-next-btn absolute top-1/2 left-4 -translate-y-1/2 z-30 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full border border-white/20 bg-black/10 backdrop-blur-md text-white hover:bg-[#aa4725] hover:border-[#aa4725] transition-all duration-300 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 cursor-pointer shadow-xl">
        <FiChevronLeft size={32} />
      </button>

      {/* Bottom Pagination - Center Aligned */}
      <div className="absolute bottom-10 inset-x-0 z-30 flex justify-center items-center">
        <div className="hero-custom-pagination flex items-center justify-center gap-3 pointer-events-auto" />
      </div>

      <style jsx global>{`
        /* تنظیمات بولت‌ها برای قرارگیری در وسط */
        .hero-custom-pagination {
          display: flex !important;
          justify-content: center !important;
          width: 100% !important;
        }

        .hero-custom-pagination .swiper-pagination-bullet {
          width: 10px !important;
          height: 10px !important;
          background: rgba(255, 255, 255, 0.6) !important;
          opacity: 1 !important;
          cursor: pointer !important;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border-radius: 50% !important;
          margin: 0 6px !important;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        }

        .hero-custom-pagination .swiper-pagination-bullet-active {
          width: 35px !important;
          background: #aa4725 !important;
          border-radius: 5px !important;
        }
      `}</style>
    </section>
  );
}
