"use client";

import { useState } from "react";
import { FiShoppingCart, FiCheck, FiLoader } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const AddToCartButton = ({ onAddToCart }) => {
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || isAdded) return;

    setIsLoading(true);
    // شبیه‌سازی اتصال به سرور
    await new Promise((r) => setTimeout(r, 800));
    setIsLoading(false);

    setIsAdded(true);
    onAddToCart?.();

    // بازگشت به حالت عادی بعد از ۲ ثانیه
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="relative flex-1 group outline-none"
    >
      <motion.div
        animate={{
          backgroundColor: isAdded ? "#10b981" : "#aa4725",
          scale: isLoading ? 0.98 : 1,
        }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative flex items-center justify-center gap-3
          h-[52px] px-8 rounded-[6px]
          text-white text-sm font-bold uppercase tracking-wider
          transition-all duration-300
          shadow-[0_10px_20px_-10px_rgba(170,71,37,0.4)]
          ${isAdded ? "shadow-[0_10px_20px_-10px_rgba(16,185,129,0.4)]" : "hover:shadow-[0_15px_25px_-10px_rgba(170,71,37,0.5)]"}
          disabled:cursor-not-allowed overflow-hidden
        `}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <FiLoader className="h-5 w-5 animate-spin" />
            </motion.div>
          ) : isAdded ? (
            <motion.div
              key="added"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <FiCheck className="h-5 w-5 stroke-[3]" />
              <span className="font-bold">تایید شد</span>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <FiShoppingCart className="h-5 w-5" />
              <span className="font-bold">افزودن به سبد خرید</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* افکت نوری که هنگام هاور از روی دکمه رد می‌شود */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
      </motion.div>
      
      {/* استایل انیمیشن Shimmer در Tailwind config باید باشد، یا به صورت مستقیم: */}
      <style jsx>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </button>
  );
};

export default AddToCartButton;