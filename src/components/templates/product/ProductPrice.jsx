"use client";
import { motion } from "framer-motion";

const ProductPrice = ({ basePrice, discountedPrice, hasDiscount }) => {
  const formatPrice = (price) =>
    new Intl.NumberFormat("fa-IR").format(price);

  const discountPercent =
    hasDiscount && basePrice > 0
      ? Math.round(((basePrice - discountedPrice) / basePrice) * 100)
      : 0;

  return (
    <div className="mb-8 p-6 bg-gray-50/50 rounded-[6px] border border-gray-100/50 backdrop-blur-sm rtl text-right" dir="rtl">
      <div className="flex flex-col gap-2">
        {hasDiscount ? (
          <div className="flex flex-col gap-3">
            {/* ردیف قیمت قبلی و درصد تخفیف */}
            <div className="flex items-center gap-3">
              <span className="text-sm md:text-base text-gray-400 line-through decoration-gray-300 font-medium">
                {formatPrice(basePrice)}
              </span>
              
              <motion.span 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#aa4725] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-[#aa4725]/20 uppercase tracking-tighter"
              >
                {discountPercent}% OFF
              </motion.span>
            </div>

            {/* قیمت نهایی */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-bold text-[#1a1a1a] tracking-tight">
                {formatPrice(discountedPrice)}
              </span>
              <span className="text-sm font-bold text-gray-500">تومان</span>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-bold text-[#aa4725] tracking-tight">
              {formatPrice(basePrice)}
            </span>
            <span className="text-sm font-bold text-gray-500">تومان</span>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProductPrice;