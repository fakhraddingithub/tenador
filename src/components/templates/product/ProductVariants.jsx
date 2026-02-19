"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const ProductVariants = ({ variants = [] }) => {
  // ذخیره انتخاب‌ها بر اساس ایندکس ردیف برای جلوگیری از هرگونه تداخل
  // ساختار: { "0": "L1", "1": "Blue" }
  const [selected, setSelected] = useState({});

  const handleSelect = (groupIndex, optionValue) => {
    setSelected((prev) => ({
      ...prev,
      [groupIndex]: optionValue, // انتخاب هر ردیف فقط بر اساس جایگاه خودش ذخیره می‌شود
    }));
  };

  if (!variants || variants.length === 0) return null;

  return (
    <div className="mb-8 space-y-10 rtl text-right" dir="rtl">
      {variants.map((variant, vIdx) => (
        <div key={vIdx} className="relative">
          {/* Label & Active Choice */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#aa4725] rounded-full"></span>
              <span className="text-sm font-bold text-gray-800 tracking-tight">
                {variant.label}
              </span>
            </div>
            
            {selected[vIdx] && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[11px] font-bold text-[#aa4725] bg-[#aa4725]/5 px-2 py-0.5 rounded"
              >
                {selected[vIdx]}
              </motion.span>
            )}
          </div>

          {/* Options Wrapper */}
          <div className="flex flex-wrap gap-3">
            {variant.value?.map((val, idx) => {
              // شرط فعال بودن: آیا مقدار انتخاب شده در این ردیف (vIdx) با این دکمه یکی است؟
              const isActive = selected[vIdx] === val;

              return (
                <button
                  key={`${vIdx}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(vIdx, val)}
                  className={`
                    relative h-12 min-w-[75px] px-4
                    rounded-[6px] text-xs font-bold transition-all duration-300
                    flex items-center justify-center gap-2 border
                    ${
                      isActive
                        ? "border-[#aa4725] bg-[#aa4725] text-white shadow-lg shadow-[#aa4725]/20 scale-[1.05]"
                        : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600"
                    }
                  `}
                >
                  {/* نقطه متحرک مخصوص هر ردیف */}
                  {isActive && (
                    <motion.div
                      layoutId={`active-indicator-${vIdx}`}
                      className="w-1.5 h-1.5 bg-white rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <span className="relative z-10">{val}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductVariants;