"use client";

import { motion } from "framer-motion";
import ProductComparisonGraph from "@/components/templates/productCompare/ProductComparisonGraph";

const ProductAttributesTable = ({ attributes = [], technicalStats }) => {
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
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            viewport={{ once: true }}
            key={index}
            className="flex items-center justify-between py-4 border-b border-gray-100 group hover:bg-gray-50/50 transition-colors px-2"
          >
            {/* بخش عنوان ویژگی */}
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-[#aa4725] transition-colors" />
              <span className="text-[11px] font-bold uppercase tracking-tighter text-gray-400 group-hover:text-gray-600">
                {attr.label}
              </span>
            </div>

            {/* بخش مقدار ویژگی - اصلاح شده */}
            <div 
              className="text-sm font-bold text-[#1a1a1a] flex-1 text-left mr-4" 
              dir="ltr"
            >
              {attr.value ? attr.value : ""}
            </div>
          </motion.div>
        ))}
      </div>
      
      <div dir="rtl">
         <ProductComparisonGraph technicalStats={technicalStats} />
      </div>
    </motion.div>
  );
};

export default ProductAttributesTable;