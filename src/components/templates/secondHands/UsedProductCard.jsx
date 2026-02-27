"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye, FaRegHeart, FaHeart, FaArrowLeft } from "react-icons/fa";
import { FiStar } from "react-icons/fi";

export default function UsedProductCard({
  product,
  onQuickView,
  onToggleWishlist,
  isWishlisted = false,
}) {
  const { name, price, overallScore, images, baseProduct } = product;
  const mainImage = images?.[0] || baseProduct?.mainImage;
  const [activeImage, setActiveImage] = useState(mainImage);

  // حذف گالری تصاویر و متغیرهای مرتبط
  // const imageVariants = useMemo(
  //   () =>
  //     images?.slice(1).map((img, i) => ({ _id: `img-${i}`, src: img })) || [],
  //   [images],
  // );

  // const hasVariants = imageVariants.length > 0;

  const splitName = (text = "") => {
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
      return {
        farsi: text.substring(0, match.index).trim(),
        english: match[0].trim(),
      };
    }
    return { farsi: text, english: "" };
  };

  const { farsi, english } = splitName(name);

  return (
    // کاهش حداکثر عرض کارت برای کنترل اندازه در گرید
    <div className="group relative bg-white border border-gray-200 rounded-[6px] transition-all duration-500 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 overflow-hidden h-full flex flex-col max-w-[260px] mx-auto">
      <Link
        href={`/second-hands/${product._id}`}
        className="absolute inset-0 z-0"
      />

      {/* لوگو برند - کوچک شده */}
      {baseProduct?.brand?.logo && (
        <div className="absolute top-2 left-2 z-20 opacity-80">
          <Image
            src={baseProduct.brand.logo}
            alt={baseProduct.brand.title || "brand"}
            width={40}
            height={40}
            className="object-contain"
          />
        </div>
      )}

      {/* تصویر اصلی */}
      <Link
        href={`/second-hands/${product._id}`}
        className="relative w-full aspect-square bg-[#fcfcfc] overflow-hidden"
      >
        <Image
          src={activeImage || "/images/placeholder.jpg"}
          alt={name}
          fill
          className="object-contain p-4 transition-all duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="relative z-20 flex items-center justify-center h-[44px]">
        <div className="flex items-center gap-2 px-3 text-[var(--color-primary)]">
          <FiStar size={14} className="fill-current" />
          <span className="text-[12px] font-bold">امتیاز سلامت:</span>
          <span className="text-[14px] font-black">{`${overallScore}/10`}</span>
        </div>
      </div>

      {/* محتوا - پدینگ کمتر */}
      <div className="p-3 pt-0 flex flex-col items-center text-center relative z-10 pointer-events-none flex-1">
        <div className="mb-2 h-[52px] flex flex-col justify-start overflow-hidden">
          <h3 className="text-[13px] font-bold text-gray-800 leading-5 mb-0.5 line-clamp-1">
            {farsi}
          </h3>
          <p className="text-[11px] text-gray-500 font-medium leading-4 line-clamp-2 dir-ltr">
            {english}
          </p>
        </div>

        {/* قیمت - سایز کوچک‌تر */}
        <div className="mt-auto flex flex-col items-center">
          <span className="text-[16px] font-black text-[#aa4725]">
            {Number(price).toLocaleString()}{" "}
            <small className="text-[9px] font-bold">تومان</small>
          </span>
        </div>

        {/* دکمه‌های اکشن - فشرده‌تر */}
        <div className="flex items-center gap-5 pointer-events-auto border-t border-gray-50 mt-3 pt-3 w-full justify-center">
          <ActionButton
            icon={<FaEye />}
            label="نمایش سریع"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.();
            }}
          />

          <Link
            href={`/second-hands/${product._id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ActionButton icon={<FaArrowLeft />} label="صفحه محصول" />
          </Link>

          <ActionButton
            icon={
              isWishlisted ? (
                <FaHeart className="text-red-500" />
              ) : (
                <FaRegHeart />
              )
            }
            label={isWishlisted ? "حذف از لیست" : "افزودن به علاقه‌مندی"}
            onClick={(e) => {
              e.preventDefault();
              onToggleWishlist?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <div className="relative group/btn flex flex-col items-center">
      <span className="absolute -top-8 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded-[2px] whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-all duration-300 pointer-events-none">
        {label}
      </span>
      <button
        onClick={onClick}
        // آیکون‌ها کوچک‌تر شدند
        className="text-gray-700 hover:text-[#aa4725] transition-colors duration-300 text-[16px] cursor-pointer"
      >
        {icon}
      </button>
    </div>
  );
}