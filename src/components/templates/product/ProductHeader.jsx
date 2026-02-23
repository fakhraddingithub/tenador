"use client";
import { motion } from "framer-motion";

const ProductHeader = ({ name, shortDescription }) => {
    // تابع هوشمند برای جدا کردن فارسی از انگلیسی و پرانتزها
    const splitName = (text) => {
      // پیدا کردن اولین جایی که متن انگلیسی یا پرانتز شروع می‌شود
      const match = text.match(/[a-zA-Z\(].*/);
      if (match) {
        const firstPart = text.substring(0, match.index).trim();
        const secondPart = match[0].trim();
        return { farsi: firstPart, english: secondPart };
      }
      return { farsi: text, english: "" };
    };
  
    const { farsi, english } = splitName(name);
    
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
        {farsi}
        <br/>
        {english}

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