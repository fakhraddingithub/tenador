"use client";
import { motion } from "framer-motion";

const ProductHeader = ({ name, shortDescription }) => {
  return (
    <div className="mb-8 relative rtl text-right" dir="rtl">

      {/* Product Name */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="
          text-[#1a1a1a]
          text-3xl
          md:text-3xl
          lg:text-4xl
          font-bold
          leading-[1.1]
          tracking-tight
          mb-4
        "
      >
        {name}
      </motion.h1>

      {/* Short Description Container */}
      {shortDescription && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          {/* تزئین سمت راست (خط عمودی مدرن) */}
          <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gray-100 rounded-full" />
          
          <p
            className="
              pr-5
              text-sm
              md:text-base
              leading-8
              text-gray-500
              font-medium
              max-w-2xl
            "
          >
            {/* تمیز کردن تگ‌های HTML اگر وجود داشته باشند */}
            <span 
              dangerouslySetInnerHTML={{ __html: shortDescription }}
              className="block"
            />
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default ProductHeader;