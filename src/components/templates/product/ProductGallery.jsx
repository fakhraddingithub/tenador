"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import GalleryImageViewer from "@/components/ui/GalleryImageViewer";

const ProductGallery = ({ images = [], logo, verified = false, productName = "" }) => {
  const mainAlt = productName || "نمای محصول";
  const [activeIndex, setActiveIndex] = useState(0);

  const prevImagesRef = useRef(images);
  useEffect(() => {
    if (prevImagesRef.current !== images) {
      prevImagesRef.current = images;
      setActiveIndex(0);
    }
  }, [images]);

  if (!images || images.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 w-full border border-gray-100 shadow-sm" dir="rtl">
      
      {/* Main Image */}
      <div className="relative group w-full">
        <div className="relative aspect-square w-full overflow-hidden rounded-[6px] bg-[#fdfdfd]">

          {/* نشان تست‌شده - گوشه بالا راست تصویر گالری */}
          {verified && (
            <div className="absolute top-3 right-3 z-30">
              <VerifiedBadge size={28} />
            </div>
          )}

          {/* Logo */}
          {logo && (
            <div className="absolute top-3 left-3 z-30">
              <Image
                src={logo}
                alt="brand logo"
                width={45}
                height={45}
                className="object-contain"
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full h-full"
            >
              <Image
                src={images[activeIndex]}
                alt={mainAlt}
                fill
                priority
                className="object-contain p-6 transition-transform duration-700 group-hover:scale-110"
              />
            </motion.div>
          </AnimatePresence>

          {/* لایهٔ تعاملی: تول‌تیپِ دنبال‌کنندهٔ ماوس + لایت‌باکسِ زوم */}
          <GalleryImageViewer src={images[activeIndex]} alt={mainAlt} />
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex flex-wrap gap-3 mt-2">
        {images.map((image, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={image}
              onClick={() => setActiveIndex(index)}
              className={`
                relative h-20 w-20 shrink-0
                rounded-[6px] overflow-hidden transition-all duration-300
                border-2 group
                ${isActive
                  ? "border-[#aa4725] shadow-md shadow-[#aa4725]/10 scale-105"
                  : "border-transparent bg-gray-50 hover:bg-white hover:border-gray-200"}
              `}
            >
              <Image
                src={image}
                alt={`${mainAlt} - تصویر ${index + 1}`}
                fill
                className={`
                  object-cover p-1.5 transition-transform duration-300
                  ${isActive ? "scale-100" : "scale-90 opacity-50 group-hover:opacity-100"}
                `}
              />
              {!isActive && (
                <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGallery;
