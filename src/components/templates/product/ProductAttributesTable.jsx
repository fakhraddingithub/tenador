"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import ProductComparisonGraph from "@/components/templates/productCompare/ProductComparisonGraph";
import AttributeInfoTooltip from "./AttributeInfoTooltip";

// یک ردیفِ مشخصات فنی. اگر ویژگی توضیح داشته باشد، کلِ ردیف کلیک‌پذیر می‌شود و
// تولتیپِ آن باز/بسته می‌شود (آیکونِ ؟ فقط نشانگر است).
function SpecRow({ attr, index, open, onToggle, onClose }) {
  const rowRef = useRef(null);
  const hasDesc =
    typeof attr.description === "string" && attr.description.trim().length > 0;

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      viewport={{ once: true }}
      onClick={hasDesc ? onToggle : undefined}
      onKeyDown={
        hasDesc
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
      role={hasDesc ? "button" : undefined}
      tabIndex={hasDesc ? 0 : undefined}
      aria-expanded={hasDesc ? open : undefined}
      className={`flex items-center justify-between py-4 border-b border-gray-100 group hover:bg-gray-50/50 transition-colors px-2 outline-none ${
        hasDesc ? "cursor-pointer" : ""
      }`}
    >
      {/* بخش عنوان ویژگی */}
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-[#aa4725] transition-colors" />
        <span className="text-[11px] font-bold uppercase tracking-tighter text-gray-400 group-hover:text-gray-600">
          {attr.label}
        </span>
        <AttributeInfoTooltip
          description={attr.description}
          open={open}
          onClose={onClose}
          rowRef={rowRef}
        />
      </div>

      {/* بخش مقدار ویژگی */}
      <div className="text-sm font-bold text-[#1a1a1a] flex-1 text-left mr-4" dir="ltr">
        {attr.value ? attr.value : ""}
      </div>
    </motion.div>
  );
}

const ProductAttributesTable = ({ attributes = [], technicalStats }) => {
  // فقط یک تولتیپ هم‌زمان باز است → اندیسِ ردیفِ باز در والد نگه‌داری می‌شود.
  const [openIndex, setOpenIndex] = useState(null);

  if (!attributes || attributes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1"
      dir="rtl"
    >
      <div className="text-right">
        {attributes.map((attr, index) => (
          <SpecRow
            key={index}
            attr={attr}
            index={index}
            open={openIndex === index}
            onToggle={() => setOpenIndex((cur) => (cur === index ? null : index))}
            onClose={() => setOpenIndex((cur) => (cur === index ? null : cur))}
          />
        ))}
      </div>

      <div dir="rtl">
        <ProductComparisonGraph technicalStats={technicalStats} />
      </div>
    </motion.div>
  );
};

export default ProductAttributesTable;
