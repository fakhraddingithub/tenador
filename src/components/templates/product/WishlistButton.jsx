"use client";

import { FiHeart } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useWishlist from "@/hooks/useWishlist";

const WishlistButton = ({ product }) => {
  const { isWishlisted: active, toggle, isLoading } = useWishlist(product);

  const handleClick = () => {
    toggle();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={active ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      className="relative outline-none group disabled:cursor-wait disabled:opacity-60"
    >
      <motion.div
        whileTap={{ scale: 0.85 }}
        className={`
          flex items-center justify-center
          w-[52px] h-[52px] rounded-[6px]
          border-2 transition-all duration-300
          ${
            active
              ? "bg-[#aa4725]/5 border-[#aa4725] text-[#aa4725] shadow-[0_0_15px_rgba(170,71,37,0.2)]"
              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600"
          }
        `}
      >
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="active"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1.1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <FaHeart className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="inactive"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <FiHeart className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ذرات شناور هنگام فعال شدن (Micro-interaction) */}
        {active && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                animate={{ opacity: 0, scale: 0, x: (i % 2 === 0 ? 20 : -20), y: (i < 2 ? 20 : -20) }}
                transition={{ duration: 0.6 }}
                className="absolute w-1 h-1 bg-[#aa4725] rounded-full"
              />
            ))}
          </>
        )}
      </motion.div>

      {/* Tooltip ظریف برای هاور */}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-bold">
        {active ? "در لیست شما" : "علاقه‌مندی"}
      </span>
    </button>
  );
};

export default WishlistButton;
