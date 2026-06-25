"use client";

import { useState } from "react";
import { FiShoppingCart, FiCheck, FiLoader, FiTrash2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const AddToCartButton = ({ onAddToCart, inCart = false, disabled = false }) => {
  const [isAdded,   setIsAdded]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || disabled) return;

    // اگه در سبده → مستقیم حذف کن بدون انیمیشن لودینگ
    if (inCart) {
      onAddToCart?.();
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsLoading(false);

    setIsAdded(true);
    onAddToCart?.();

    setTimeout(() => setIsAdded(false), 2000);
  };

  // رنگ پس‌زمینه بر اساس وضعیت
  const bgColor = disabled
    ? "#d1d5db"   // خاکستری روشن — غیرفعال (انتخاب ناقص/ناموجود)
    : inCart
    ? "#e5e7eb"   // خاکستری — در سبد
    : isAdded
    ? "#10b981"   // سبز — تایید شد
    : "#aa4725";  // نارنجی — حالت عادی

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || disabled}
      className={`relative w-full flex-1 group outline-none ${disabled ? "cursor-not-allowed" : ""}`}
    >
      <motion.div
        animate={{ backgroundColor: bgColor, scale: isLoading ? 0.98 : 1 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative flex items-center justify-center gap-3
          h-[52px] px-8 rounded-[6px]
          text-sm font-bold uppercase tracking-wider
          transition-all duration-300 overflow-hidden
          ${inCart
            ? "text-gray-600 border-2 border-gray-300 shadow-none hover:border-red-300"
            : "text-white shadow-[0_10px_20px_-10px_rgba(170,71,37,0.4)] hover:shadow-[0_15px_25px_-10px_rgba(170,71,37,0.5)]"
          }
          disabled:cursor-not-allowed
        `}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <FiLoader className="h-5 w-5 animate-spin" />
            </motion.div>

          ) : inCart ? (
            <motion.div key="inCart"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 group-hover:hidden">
              <FiCheck className="h-5 w-5 stroke-[3] text-gray-500" />
              <span className="font-bold text-gray-600">در سبد خرید</span>
            </motion.div>

          ) : isAdded ? (
            <motion.div key="added"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2">
              <FiCheck className="h-5 w-5 stroke-[3]" />
              <span className="font-bold">تایید شد</span>
            </motion.div>

          ) : (
            <motion.div key="default"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2">
              <FiShoppingCart className="h-5 w-5" />
              <span className="font-bold">افزودن به سبد خرید</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* متن حذف — فقط هنگام hover در حالت inCart */}
        {inCart && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-2
              bg-red-50 text-red-500 rounded-[6px] border-2 border-red-300 transition-all"
          >
            <FiTrash2 className="h-4 w-4" />
            <span className="font-bold text-sm">حذف از سبد خرید</span>
          </motion.div>
        )}

        {/* افکت نوری shimmer */}
        {!inCart && (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10
            to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        )}
      </motion.div>
    </button>
  );
};

export default AddToCartButton;