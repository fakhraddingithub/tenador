"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowUpLeft, FiChevronDown } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";

export default function SportsGrid({ categories = [] }) {
  const [showAll, setShowAll] = useState(false);

  // ۴ مورد اول برای نمایش در گرید اصلی
  const initialCategories = categories.slice(0, 4);
  // بقیه موارد برای نمایش در بخش کشویی
  const remainingCategories = categories.slice(4);

  // استایل چیدمان برای ۴ کارت اول (ایجاد یک بلوک مستطیلی کامل و جذاب)
  const getTopGridSpan = (index) => {
    const patterns = [
      "md:col-span-2 md:row-span-2", // 0: بزرگ (مربع دو در دو)
      "md:col-span-1 md:row-span-1", // 1: کوچک (بالا)
      "md:col-span-1 md:row-span-2", // 2: عمودی (بلند)
      "md:col-span-1 md:row-span-1", // 3: کوچک (پایین)
    ];
    return patterns[index] || "md:col-span-1 md:row-span-1";
  };

  return (
    <section className="py-20 bg-white text-black">
      <div className="container mx-auto px-4 md:px-12 lg:px-16 xl:px-20">
        {/* هدر بخش */}
        <div className="relative mb-12">
          <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">
            <span className="text-[#aa4725]">رشته‌های </span>
            <span>ورزشی</span>
          </h2>
          <p className="text-gray-500 mt-2 md:mt-4 text-sm md:text-lg font-light max-w-md border-r-2 md:border-r-4 border-[#aa4725]/20 pr-3 md:pr-4 italic">
            تجهیزات تخصصی برای هر سبک بازی
          </p>
        </div>
        {/* گرید اصلی (۴ آیتم اول) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[220px] md:auto-rows-[260px]">
          {initialCategories.map((category, index) => (
            <CategoryCard
              key={category._id}
              category={category}
              className={getTopGridSpan(index)}
            />
          ))}
        </div>

        {/* بخش کشویی برای بقیه ورزش‌ها */}
        <AnimatePresence initial={false}>
          {showAll && remainingCategories.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 auto-rows-[260px]">
                {remainingCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    className="md:col-span-1 md:row-span-1"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* دکمه کشویی (آکاردئون) */}
        {categories.length > 4 && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="group flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-8 py-4 transition-all duration-300"
              style={{ borderRadius: "6px" }}
            >
              <span className="font-bold text-sm text-gray-800">
                {showAll ? "بستن لیست" : "مشاهده همه ورزش ها"}
              </span>
              <div
                className="bg-white border border-gray-200 p-1.5 shadow-sm transition-transform duration-500"
                style={{
                  borderRadius: "6px",
                  transform: showAll ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <FiChevronDown className="text-[#aa4725]" size={20} />
              </div>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// کامپوننت مجزا برای کارت‌ها جهت تمیزی کد
function CategoryCard({ category, className }) {
  return (
    <Link
      href={`/${category.slug}`}
      className={`relative group block w-full h-full overflow-hidden bg-gray-100 ${className}`}
      style={{ borderRadius: "6px" }}
    >
      {/* تصویر اصلی */}
      <img
        src={category.image}
        alt={category.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* شید تیره در حالت عادی برای خوانایی متن */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-40" />

      {/* عنوان در حالت عادی (با هاور محو می‌شود) */}
      <div className="absolute inset-x-0 bottom-0 p-6 flex items-center justify-between transition-all duration-500 opacity-100 group-hover:opacity-0 group-hover:translate-y-4">
        {/* بخش نام و آیکون در یک ردیف */}
        <div className="flex items-center gap-3">
          {category.icon && (
            <div className="w-8 h-8 relative flex-shrink-0">
              <Image
                src={category.icon}
                alt={category.name}
                fill
                className="object-contain brightness-0 invert"
              />
            </div>
          )}
          <h3 className="text-white text-2xl font-bold">{category.title}</h3>
        </div>

        {/* اگر آیکون یا المان دیگری در سمت چپ (مثل فلش) داشتی اینجا قرار می‌گیرد */}
      </div>

      {/* پنل شیشه‌ای کشویی (در هاور از پایین بالا می‌آید) */}
      <div className="absolute inset-x-0 bottom-0 p-4 translate-y-[120%] group-hover:translate-y-0 transition-transform duration-500 ease-out z-20">
        <div
          className="bg-[#20232ae6]/80 backdrop-blur-lg border border-[#20232ae6] p-5 flex justify-between items-center shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          style={{ borderRadius: "6px" }}
        >
          <div>
            <span className="text-white text-[11px] font-bold block mb-1 opacity-90 drop-shadow-md">
              تجهیزات تخصصی
            </span>

            {/* ردیف آیکون و عنوان */}
            <div className="flex items-center gap-3">
              {category.icon && (
                <div className="w-7 h-7 relative flex-shrink-0">
                  <Image
                    src={category.icon}
                    alt={category.name}
                    fill
                    className="object-contain brightness-0 invert"
                  />
                </div>
              )}
              <h3 className="text-white font-bold text-2xl drop-shadow-lg">
                {category.title}
              </h3>
            </div>
          </div>

          {/* دکمه فلش */}
          <div
            className="bg-[#aa4725] text-white p-3 rotate-45 group-hover:rotate-0 transition-transform duration-500 delay-100 shadow-md flex-shrink-0"
            style={{ borderRadius: "6px" }}
          >
            <FiArrowUpLeft size={22} />
          </div>
        </div>
      </div>
    </Link>
  );
}
